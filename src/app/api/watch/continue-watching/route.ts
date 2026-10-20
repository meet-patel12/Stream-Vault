import { NextRequest } from "next/server";
import { db } from "@/db";
import { watchHistory, content, contentGenres, genres, profiles } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/watch/continue-watching?profileId=...
 * Netflix-Style Ranked Continue Watching Engine
 * Features:
 * - Time-decay recency weighting
 * - Engagement sweet-spot ranking (10% - 85% completion gets high priority)
 * - Credits / barely-started suppression
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const profileIdStr = searchParams.get("profileId");
    if (!profileIdStr) return validationErrorResponse("profileId is required.");

    const profileId = parseInt(profileIdStr, 10);
    const userId = parseInt(session.sub, 10);

    // Verify profile belongs to user
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found.");

    // Fetch active uncompleted history (progress > 5 seconds, not completed)
    const historyRows = await db
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
      .limit(20);

    if (historyRows.length === 0) {
      return successResponse({ items: [] });
    }

    const contentIds = [...new Set(historyRows.map((h) => h.contentId))];

    // Fetch content items
    const contentItems = await db
      .select()
      .from(content)
      .where(inArray(content.id, contentIds));

    // Fetch genres
    const genreJoins = await db
      .select({
        contentId: contentGenres.contentId,
        genreId: genres.id,
        genreName: genres.name,
        genreSlug: genres.slug,
      })
      .from(contentGenres)
      .innerJoin(genres, eq(contentGenres.genreId, genres.id))
      .where(inArray(contentGenres.contentId, contentIds));

    const genresByContent = genreJoins.reduce<
      Record<number, { id: number; name: string; slug: string }[]>
    >((acc, row) => {
      if (!acc[row.contentId]) acc[row.contentId] = [];
      if (!acc[row.contentId].some((g) => g.id === row.genreId)) {
        acc[row.contentId].push({ id: row.genreId, name: row.genreName, slug: row.genreSlug });
      }
      return acc;
    }, {});

    const contentMap = new Map(contentItems.map((c) => [c.id, c]));
    const now = Date.now();

    // Netflix Heuristic Ranking for Continue Watching
    const rankedRows = historyRows
      .map((h) => {
        const item = contentMap.get(h.contentId);
        if (!item) return null;

        const updatedTime = new Date(h.updatedAt).getTime();
        const ageInHours = Math.max(0, (now - updatedTime) / (1000 * 60 * 60));

        // Recency decay factor (half-life of ~48 hours)
        const recencyScore = 100 / (1 + ageInHours * 0.02);

        // Completion ratio
        const ratio =
          h.totalSeconds && h.totalSeconds > 0
            ? h.progressSeconds / h.totalSeconds
            : 0;

        let engagementScore = 0;
        if (ratio >= 0.15 && ratio <= 0.85) {
          // Sweet spot: User actively engaged in middle of content
          engagementScore = 30;
        } else if (ratio > 0.85) {
          // Likely credits, lower priority
          engagementScore = -20;
        } else {
          // Just started (< 15%)
          engagementScore = 10;
        }

        const totalScore = recencyScore + engagementScore;

        return {
          ...item,
          genres: genresByContent[item.id] || [],
          watchProgress: {
            id: h.id,
            profileId: h.profileId,
            contentId: h.contentId,
            episodeId: h.episodeId,
            progressSeconds: h.progressSeconds,
            totalSeconds: h.totalSeconds,
            completed: h.completed,
            updatedAt: h.updatedAt.toISOString(),
          },
          rankingScore: totalScore,
        };
      })
      .filter(Boolean) as any[];

    // Sort by algorithmic ranking score descending
    rankedRows.sort((a, b) => b.rankingScore - a.rankingScore);

    // Deduplicate by contentId so the user sees one entry per title (highest ranking/most recent)
    const seenContentIds = new Set<number>();
    const deduplicatedRankedRows: any[] = [];
    for (const row of rankedRows) {
      if (!seenContentIds.has(row.id)) {
        seenContentIds.add(row.id);
        deduplicatedRankedRows.push(row);
      }
    }

    return successResponse({
      items: deduplicatedRankedRows.slice(0, 15),
      count: deduplicatedRankedRows.length,
    });
  } catch (err) {
    console.error("[Continue Watching Error]:", err);
    return internalErrorResponse();
  }
}
