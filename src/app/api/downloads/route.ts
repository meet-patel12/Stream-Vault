import { NextRequest } from "next/server";
import { db } from "@/db";
import { offlineDownloads, content, episodes, profiles } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/downloads?profileId=...
 * Fetch active offline downloads for profile
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const profileIdStr = searchParams.get("profileId");
    if (!profileIdStr) return validationErrorResponse("profileId is required");

    const profileId = parseInt(profileIdStr, 10);
    const userId = parseInt(session.sub, 10);

    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found");

    const downloadsList = await db
      .select()
      .from(offlineDownloads)
      .where(eq(offlineDownloads.profileId, profileId))
      .orderBy(desc(offlineDownloads.downloadedAt));

    if (downloadsList.length === 0) {
      return successResponse({ downloads: [], totalStorageBytes: 0 });
    }

    const contentIds = [...new Set(downloadsList.map((d) => d.contentId))];
    const episodeIds = downloadsList.map((d) => d.episodeId).filter((id): id is number => id !== null);

    const [contentItems, episodeItems] = await Promise.all([
      db.select().from(content).where(inArray(content.id, contentIds)),
      episodeIds.length > 0
        ? db.select().from(episodes).where(inArray(episodes.id, episodeIds))
        : Promise.resolve([]),
    ]);

    const contentMap = new Map(contentItems.map((c) => [c.id, c]));
    const episodeMap = new Map(episodeItems.map((e) => [e.id, e]));

    let totalStorageBytes = 0;

    const enriched = downloadsList.map((d) => {
      totalStorageBytes += Number(d.fileSizeBytes || 0);
      return {
        ...d,
        content: contentMap.get(d.contentId) || null,
        episode: d.episodeId ? episodeMap.get(d.episodeId) || null : null,
      };
    });

    return successResponse({ downloads: enriched, totalStorageBytes });
  } catch (err) {
    console.error("[Downloads GET Error]:", err);
    return internalErrorResponse();
  }
}

/**
 * POST /api/downloads
 * Register new offline download
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { profileId, contentId, episodeId = null, quality = "1080p" } = body;

    if (!profileId || !contentId) {
      return validationErrorResponse("profileId and contentId are required");
    }

    const userId = parseInt(session.sub, 10);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found");

    // Calculate estimated file size based on quality & duration
    const [targetContent] = await db
      .select()
      .from(content)
      .where(eq(content.id, contentId))
      .limit(1);

    if (!targetContent) return notFoundResponse("Content not found");

    const durationMinutes = targetContent.duration || 110;
    // Estimated file sizes: 720p ~ 8MB/min, 1080p ~ 18MB/min, 4K ~ 45MB/min
    const byteMultiplier =
      quality === "4k" ? 45 * 1024 * 1024 : quality === "720p" ? 8 * 1024 * 1024 : 18 * 1024 * 1024;
    const estimatedSizeBytes = Math.round((durationMinutes / 60) * byteMultiplier);

    // 30 days expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [newDownload] = await db
      .insert(offlineDownloads)
      .values({
        userId,
        profileId,
        contentId,
        episodeId,
        quality,
        fileSizeBytes: estimatedSizeBytes,
        storagePath: `local://cache/content_${contentId}${episodeId ? `_ep${episodeId}` : ""}_${quality}.mp4`,
        status: "completed",
        expiresAt,
      })
      .returning();

    return successResponse(newDownload);
  } catch (err) {
    console.error("[Downloads POST Error]:", err);
    return internalErrorResponse();
  }
}

/**
 * DELETE /api/downloads?id=...
 * Delete downloaded title
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const downloadIdStr = searchParams.get("id");
    if (!downloadIdStr) return validationErrorResponse("id is required");

    const downloadId = parseInt(downloadIdStr, 10);
    const userId = parseInt(session.sub, 10);

    await db
      .delete(offlineDownloads)
      .where(
        and(
          eq(offlineDownloads.id, downloadId),
          eq(offlineDownloads.userId, userId)
        )
      );

    return successResponse(null);
  } catch (err) {
    console.error("[Downloads DELETE Error]:", err);
    return internalErrorResponse();
  }
}
