import { NextRequest } from "next/server";
import { db } from "@/db";
import { episodes, content } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const {
      contentId,
      seasonNumber = 1,
      episodeNumber,
      title,
      description,
      duration,
      thumbnailUrl,
      videoKey,
    } = body;

    if (!contentId || !episodeNumber || !title || !videoKey) {
      return validationErrorResponse(
        "contentId, episodeNumber, title, and videoKey are required."
      );
    }

    const [targetContent] = await db
      .select()
      .from(content)
      .where(eq(content.id, contentId))
      .limit(1);

    if (!targetContent) {
      return notFoundResponse("Target series content not found.");
    }

    const [newEpisode] = await db
      .insert(episodes)
      .values({
        contentId: Number(contentId),
        seasonNumber: Number(seasonNumber),
        episodeNumber: Number(episodeNumber),
        title,
        description: description ?? null,
        duration: duration ? Number(duration) : null,
        thumbnailUrl: thumbnailUrl ?? targetContent.posterUrl,
        videoKey,
        hlsManifestKey: videoKey,
      })
      .returning();

    return successResponse(newEpisode, 201);
  } catch (err) {
    console.error("Episode creation error:", err);
    return internalErrorResponse();
  }
}
