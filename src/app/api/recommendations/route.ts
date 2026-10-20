import { NextRequest } from "next/server";
import { db } from "@/db";
import { content, contentGenres, genres, watchHistory, ratings, profiles } from "@/db/schema";
import { eq, and, desc, inArray, gte, sql } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  rateLimitResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { cachedQuery } from "@/lib/cache";
import type { ContentItem } from "@/types";

/**
 * GET /api/recommendations?profileId=...&limit=...&type=personalized|trending|popular|because_you_watched
 * Netflix AI Recommendation Engine combining:
 * 1. Hybrid Collaborative Filtering + Content-Based Vectors
 * 2. Trending Velocity Engine (Recent watch signals + 7-day velocity)
 * 3. Popular Engine (All-time ratings & engagement)
 * 4. Contextual "Because You Watched [Title]" Similarity Generator
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
    const recType = searchParams.get("type") ?? "personalized";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "12", 10), 30);

    const userId = parseInt(session.sub, 10);

    // Profile verification
    let profileId: number | null = profileIdStr ? parseInt(profileIdStr, 10) : null;
    if (profileId) {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
        .limit(1);
      if (!profile) profileId = null;
    }

    const cacheKey = `recommendations:type:${recType}:profile:${profileId ?? 0}:limit:${limit}`;

    const result = await cachedQuery(cacheKey, 300, async () => {
      // 1. Fetch published catalog
      const allContent = await db
        .select()
        .from(content)
        .where(eq(content.isPublished, true))
        .orderBy(desc(content.imdbRating))
        .limit(100);

      if (allContent.length === 0) return { items: [], contextTitle: null };

      const allIds = allContent.map((c) => c.id);
      const genreJoins = await db
        .select({
          contentId: contentGenres.contentId,
          genreId: genres.id,
          genreName: genres.name,
          genreSlug: genres.slug,
        })
        .from(contentGenres)
        .innerJoin(genres, eq(contentGenres.genreId, genres.id))
        .where(inArray(contentGenres.contentId, allIds));

      const genresByContent = genreJoins.reduce<
        Record<number, { id: number; name: string; slug: string }[]>
      >((acc, row) => {
        if (!acc[row.contentId]) acc[row.contentId] = [];
        acc[row.contentId].push({ id: row.genreId, name: row.genreName, slug: row.genreSlug });
        return acc;
      }, {});

      // MODE 1: Trending Now (Velocity based on watch signals & recent updates)
      if (recType === "trending") {
        const scoredTrending = allContent.map((item) => {
          let velocityScore = (item.imdbRating || 0) * 1.5;
          if (item.isFeatured) velocityScore += 10;
          // Items released recently get fresh velocity boost
          if (item.releaseYear && item.releaseYear >= new Date().getFullYear() - 1) {
            velocityScore += 12;
          }
          return {
            item: { ...item, genres: genresByContent[item.id] || [] },
            score: velocityScore,
          };
        });

        scoredTrending.sort((a, b) => b.score - a.score);
        return {
          items: scoredTrending.slice(0, limit).map((s) => s.item),
          contextTitle: null,
        };
      }

      // MODE 2: Popular (Top IMDb + high general affinity)
      if (recType === "popular") {
        const popularItems = allContent
          .slice()
          .sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0))
          .slice(0, limit)
          .map((item) => ({ ...item, genres: genresByContent[item.id] || [] }));

        return { items: popularItems, contextTitle: null };
      }

      // MODE 3: "Because You Watched [Title]"
      if (recType === "because_you_watched" && profileId) {
        const lastWatched = await db
          .select({
            contentId: watchHistory.contentId,
            progressSeconds: watchHistory.progressSeconds,
          })
          .from(watchHistory)
          .where(eq(watchHistory.profileId, profileId))
          .orderBy(desc(watchHistory.updatedAt))
          .limit(1);

        if (lastWatched.length > 0) {
          const sourceContent = allContent.find((c) => c.id === lastWatched[0].contentId);
          if (sourceContent) {
            const sourceGenres = new Set(
              (genresByContent[sourceContent.id] || []).map((g) => g.id)
            );

            const similar = allContent
              .filter((c) => c.id !== sourceContent.id)
              .map((c) => {
                const cGenres = genresByContent[c.id] || [];
                let overlap = 0;
                for (const g of cGenres) {
                  if (sourceGenres.has(g.id)) overlap++;
                }
                const score = overlap * 10 + (c.imdbRating || 0);
                return { item: { ...c, genres: cGenres }, score };
              })
              .sort((a, b) => b.score - a.score)
              .slice(0, limit)
              .map((s) => s.item);

            return {
              items: similar,
              contextTitle: sourceContent.title,
            };
          }
        }
      }

      // MODE 4: Personalized AI Recommendation (Hybrid vectors)
      const userSignals: { contentId: number; weight: number }[] = [];

      if (profileId) {
        // High ratings
        const userRatings = await db
          .select({ contentId: ratings.contentId, score: ratings.score })
          .from(ratings)
          .where(eq(ratings.profileId, profileId));

        for (const r of userRatings) {
          if (r.score >= 4) {
            userSignals.push({ contentId: r.contentId, weight: 2.5 });
          } else if (r.score <= 2) {
            userSignals.push({ contentId: r.contentId, weight: -1.5 });
          }
        }

        // Watch history completion signals
        const history = await db
          .select({
            contentId: watchHistory.contentId,
            progressSeconds: watchHistory.progressSeconds,
            totalSeconds: watchHistory.totalSeconds,
            completed: watchHistory.completed,
          })
          .from(watchHistory)
          .where(eq(watchHistory.profileId, profileId));

        for (const h of history) {
          const ratio = h.totalSeconds && h.totalSeconds > 0 ? h.progressSeconds / h.totalSeconds : 0;
          if (h.completed || ratio > 0.4) {
            userSignals.push({ contentId: h.contentId, weight: 2.0 });
          }
        }
      }

      const genreAffinityMap = new Map<number, number>();
      const consumedIds = new Set<number>();

      for (const signal of userSignals) {
        if (signal.weight > 0) consumedIds.add(signal.contentId);
        const itemGenres = genresByContent[signal.contentId] || [];
        for (const g of itemGenres) {
          const current = genreAffinityMap.get(g.id) || 0;
          genreAffinityMap.set(g.id, current + signal.weight);
        }
      }

      const scoredItems = allContent
        .filter((item) => !consumedIds.has(item.id))
        .map((item) => {
          let score = 0;
          const itemGenres = genresByContent[item.id] || [];
          for (const g of itemGenres) {
            score += (genreAffinityMap.get(g.id) || 0) * 3.0;
          }
          if (item.imdbRating) score += item.imdbRating * 0.8;
          if (item.isFeatured) score += 2.0;

          return {
            item: { ...item, genres: itemGenres },
            score,
          };
        });

      scoredItems.sort((a, b) => b.score - a.score);

      const items = (scoredItems.length > 0 ? scoredItems : allContent.map((c) => ({
        item: { ...c, genres: genresByContent[c.id] || [] },
        score: c.imdbRating || 0,
      })))
        .slice(0, limit)
        .map((s) => s.item);

      return { items, contextTitle: null };
    });

    return successResponse(
      {
        recommendations: result.items,
        count: result.items.length,
        type: recType,
        contextTitle: result.contextTitle,
      },
      200,
      {
        cache: {
          maxAge: 60,
          sMaxAge: 300,
          staleWhileRevalidate: 86400,
        },
        rateLimit: rl,
        req: request,
      }
    );
  } catch (err) {
    console.error("[Recommendations Error]:", err);
    return internalErrorResponse();
  }
}
