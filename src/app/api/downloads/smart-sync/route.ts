import { NextRequest } from "next/server";
import { db } from "@/db";
import { offlineDownloads, watchHistory, episodes, content } from "@/db/schema";
import { eq, and, gt, sql, inArray } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/downloads/smart-sync
 * Smart Downloads Engine:
 * 1. Checks watch history for watched downloads (progress > 85% or completed: true)
 * 2. Auto-deletes watched downloads if autoDeleteWatched is enabled
 * 3. Identifies next episode in series and queues automatic download
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { profileId, autoDeleteWatched = true, autoDownloadNext = true } = body;

    if (!profileId) return validationErrorResponse("profileId is required");

    const userId = parseInt(session.sub, 10);

    // 1. Fetch current profile downloads
    const currentDownloads = await db
      .select()
      .from(offlineDownloads)
      .where(
        and(
          eq(offlineDownloads.userId, userId),
          eq(offlineDownloads.profileId, profileId)
        )
      );

    if (currentDownloads.length === 0) {
      return successResponse({ deletedCount: 0, queuedNextEpisodes: [] });
    }

    let deletedCount = 0;
    const queuedNextEpisodes: any[] = [];

    // 2. Fetch watch history for downloaded items
    const downloadContentIds = [...new Set(currentDownloads.map((d) => d.contentId))];
    const userHistory = await db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, profileId),
          inArray(watchHistory.contentId, downloadContentIds)
        )
      );

    const historyByItem = new Map<string, typeof watchHistory.$inferSelect>();
    for (const h of userHistory) {
      const key = `${h.contentId}_${h.episodeId ?? "movie"}`;
      historyByItem.set(key, h);
    }

    // Process each download
    for (const dl of currentDownloads) {
      const key = `${dl.contentId}_${dl.episodeId ?? "movie"}`;
      const history = historyByItem.get(key);

      const isCompleted =
        history &&
        (history.completed ||
          (history.totalSeconds &&
            history.totalSeconds > 0 &&
            history.progressSeconds / history.totalSeconds > 0.88));

      // Auto-delete watched
      if (isCompleted && autoDeleteWatched) {
        await db.delete(offlineDownloads).where(eq(offlineDownloads.id, dl.id));
        deletedCount++;

        // If it was a series episode, find and queue the next episode!
        if (dl.episodeId && autoDownloadNext) {
          const [currentEpisode] = await db
            .select()
            .from(episodes)
            .where(eq(episodes.id, dl.episodeId))
            .limit(1);

          if (currentEpisode) {
            // Find next episode in season or next season
            const [nextEp] = await db
              .select()
              .from(episodes)
              .where(
                and(
                  eq(episodes.contentId, dl.contentId),
                  gt(episodes.episodeNumber, currentEpisode.episodeNumber),
                  eq(episodes.seasonNumber, currentEpisode.seasonNumber)
                )
              )
              .orderBy(episodes.episodeNumber)
              .limit(1);

            if (nextEp) {
              // Check if already downloaded
              const alreadyDownloaded = currentDownloads.some(
                (d) => d.episodeId === nextEp.id
              );
              if (!alreadyDownloaded) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);

                const [queued] = await db
                  .insert(offlineDownloads)
                  .values({
                    userId,
                    profileId,
                    contentId: dl.contentId,
                    episodeId: nextEp.id,
                    quality: dl.quality,
                    fileSizeBytes: dl.fileSizeBytes,
                    storagePath: `local://cache/content_${dl.contentId}_ep${nextEp.id}_${dl.quality}.mp4`,
                    status: "completed",
                    expiresAt,
                  })
                  .returning();

                queuedNextEpisodes.push(queued);
              }
            }
          }
        }
      }
    }

    return successResponse({
      deletedCount,
      queuedNextEpisodes,
      syncCompletedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Smart Sync Error]:", err);
    return internalErrorResponse();
  }
}
