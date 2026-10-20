import { NextRequest } from "next/server";
import { db } from "@/db";
import { content, contentGenres, genres, watchHistory, profiles } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  rateLimitResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { cachedQuery } from "@/lib/cache";

/**
 * GET /api/content/home-feed?profileId=...&tab=all|movie|series
 * Consolidated High-Performance Browse Feed API
 * Replaces 7-10 separate HTTP round trips with a single intelligent cached query.
 */
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, "api");
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const profileIdStr = searchParams.get("profileId");
    const profileId = profileIdStr ? parseInt(profileIdStr, 10) : null;
    const tab = searchParams.get("tab") || "all";

    // 1. Fetch catalog snapshot with caching (shared across all users)
    const catalogCacheKey = `feed:catalog:v3:${tab}`;
    const sharedCatalog = await cachedQuery(catalogCacheKey, 180, async () => {
      // Query published content
      const allItems = await db
        .select()
        .from(content)
        .where(eq(content.isPublished, true))
        .orderBy(desc(content.createdAt))
        .limit(100);

      const allIds = allItems.map((i) => i.id);

      // Join genres in one single query
      const genreJoins =
        allIds.length > 0
          ? await db
              .select({
                contentId: contentGenres.contentId,
                genreId: genres.id,
                genreName: genres.name,
                genreSlug: genres.slug,
              })
              .from(contentGenres)
              .innerJoin(genres, eq(contentGenres.genreId, genres.id))
              .where(inArray(contentGenres.contentId, allIds))
          : [];

      const genresByContent = genreJoins.reduce<
        Record<number, { id: number; name: string; slug: string }[]>
      >((acc, row) => {
        if (!acc[row.contentId]) acc[row.contentId] = [];
        if (!acc[row.contentId].some((g) => g.id === row.genreId)) {
          acc[row.contentId].push({ id: row.genreId, name: row.genreName, slug: row.genreSlug });
        }
        return acc;
      }, {});

      const enriched = allItems.map((item) => ({
        ...item,
        genres: genresByContent[item.id] || [],
      }));

      // Categorize into sections
      const featured = enriched.filter((i) => i.isFeatured).slice(0, 6);
      const movies = enriched.filter((i) => i.type === "movie");
      const series = enriched.filter((i) => i.type === "series");

      // Top 10 sorted by IMDb rating
      const top10 = [...enriched]
        .sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0))
        .slice(0, 10);

      // Trending based on rating + featured
      const trending = [...enriched]
        .sort((a, b) => ((b.imdbRating || 0) + (b.isFeatured ? 2 : 0)) - ((a.imdbRating || 0) + (a.isFeatured ? 2 : 0)))
        .slice(0, 12);

      // Genre partitions
      const action = enriched.filter((i) =>
        i.genres.some((g) => g.slug === "action" || g.name.toLowerCase().includes("action"))
      ).slice(0, 12);

      const sciFi = enriched.filter((i) =>
        i.genres.some((g) => g.slug === "sci-fi" || g.name.toLowerCase().includes("sci-fi"))
      ).slice(0, 12);

      const drama = enriched.filter((i) =>
        i.genres.some((g) => g.slug === "drama" || g.name.toLowerCase().includes("drama"))
      ).slice(0, 12);

      return {
        featured: featured.length > 0 ? featured : enriched.slice(0, 5),
        movies: movies.slice(0, 15),
        series: series.slice(0, 15),
        top10,
        trending,
        action,
        sciFi,
        drama,
      };
    });

    // 2. Profile-specific personalization (Continue Watching & Recommendations)
    let continueWatching: any[] = [];
    let recommendations: any[] = [];
    let becauseYouWatched: { contextTitle: string; items: any[] } | null = null;

    if (profileId) {
      const profileKey = `feed:profile:${profileId}`;
      const profileData = await cachedQuery(profileKey, 60, async () => {
        // Continue watching rows
        const cwRows = await db
          .select({
            id: watchHistory.id,
            profileId: watchHistory.profileId,
            contentId: watchHistory.contentId,
            episodeId: watchHistory.episodeId,
            progressSeconds: watchHistory.progressSeconds,
            totalSeconds: watchHistory.totalSeconds,
            completed: watchHistory.completed,
            updatedAt: watchHistory.updatedAt,
          })
          .from(watchHistory)
          .where(
            and(
              eq(watchHistory.profileId, profileId),
              eq(watchHistory.completed, false)
            )
          )
          .orderBy(desc(watchHistory.updatedAt))
          .limit(10);

        let cwItems: any[] = [];
        if (cwRows.length > 0) {
          const cwContentIds = [...new Set(cwRows.map((h) => h.contentId))];
          const matchedContent = await db
            .select()
            .from(content)
            .where(inArray(content.id, cwContentIds));

          const contentMap = new Map(matchedContent.map((c) => [c.id, c]));
          cwItems = cwRows
            .map((h) => {
              const item = contentMap.get(h.contentId);
              if (!item) return null;
              return {
                ...item,
                watchProgress: {
                  progressSeconds: h.progressSeconds,
                  totalSeconds: h.totalSeconds,
                },
              };
            })
            .filter(Boolean);
        }

        // Recommendations based on highest rated or popular in catalog
        const recItems = sharedCatalog.trending.slice(0, 10);

        return {
          continueWatching: cwItems,
          recommendations: recItems,
          becauseYouWatched: cwItems[0]
            ? {
                contextTitle: cwItems[0].title,
                items: sharedCatalog.sciFi.slice(0, 8),
              }
            : null,
        };
      });

      continueWatching = profileData.continueWatching;
      recommendations = profileData.recommendations;
      becauseYouWatched = profileData.becauseYouWatched;
    }

    return successResponse(
      {
        ...sharedCatalog,
        continueWatching,
        recommendations,
        becauseYouWatched,
      },
      200,
      {
        cache: {
          maxAge: 60,
          sMaxAge: 180,
          staleWhileRevalidate: 86400,
        },
        rateLimit: rl,
        req: request,
      }
    );
  } catch (err) {
    console.error("Home feed error:", err);
    return internalErrorResponse();
  }
}
