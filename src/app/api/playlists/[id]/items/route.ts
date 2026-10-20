import { NextRequest } from "next/server";
import { db } from "@/db";
import { playlists, playlistItems, content } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/playlists/[id]/items
 * Add content to playlist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { id: idStr } = await params;
    const playlistId = parseInt(idStr, 10);
    const userId = parseInt(session.sub, 10);

    const body = await request.json();
    const { contentId, position = 0 } = body;

    if (!contentId) return validationErrorResponse("contentId is required");

    // Verify ownership
    const [playlist] = await db
      .select()
      .from(playlists)
      .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
      .limit(1);

    if (!playlist) return notFoundResponse("Playlist not found");

    // Check if item already exists
    const existing = await db
      .select()
      .from(playlistItems)
      .where(
        and(
          eq(playlistItems.playlistId, playlistId),
          eq(playlistItems.contentId, contentId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return successResponse(existing[0]);
    }

    const [item] = await db
      .insert(playlistItems)
      .values({
        playlistId,
        contentId: parseInt(String(contentId), 10),
        position,
      })
      .returning();

    return successResponse(item);
  } catch (err) {
    console.error("[Playlist Items POST Error]:", err);
    return internalErrorResponse();
  }
}

/**
 * DELETE /api/playlists/[id]/items?contentId=...
 * Remove content from playlist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { id: idStr } = await params;
    const playlistId = parseInt(idStr, 10);
    const userId = parseInt(session.sub, 10);

    const { searchParams } = new URL(request.url);
    const contentIdStr = searchParams.get("contentId");
    if (!contentIdStr) return validationErrorResponse("contentId is required");

    const contentId = parseInt(contentIdStr, 10);

    // Verify ownership
    const [playlist] = await db
      .select()
      .from(playlists)
      .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
      .limit(1);

    if (!playlist) return notFoundResponse("Playlist not found");

    await db
      .delete(playlistItems)
      .where(
        and(
          eq(playlistItems.playlistId, playlistId),
          eq(playlistItems.contentId, contentId)
        )
      );

    return successResponse(null);
  } catch (err) {
    console.error("[Playlist Items DELETE Error]:", err);
    return internalErrorResponse();
  }
}
