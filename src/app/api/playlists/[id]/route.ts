import { NextRequest } from "next/server";
import { db } from "@/db";
import { playlists, playlistItems, content, contentGenres, genres, profiles } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/playlists/[id]
 * Fetch playlist metadata and populated items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { id: idStr } = await params;
    const playlistId = parseInt(idStr, 10);
    const userId = parseInt(session.sub, 10);

    const [playlist] = await db
      .select()
      .from(playlists)
      .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
      .limit(1);

    if (!playlist) return notFoundResponse("Playlist not found");

    // Fetch items
    const pItems = await db
      .select()
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlistId))
      .orderBy(playlistItems.position);

    if (pItems.length === 0) {
      return successResponse({ playlist, items: [] });
    }

    const contentIds = pItems.map((i) => i.contentId);
    const contentList = await db
      .select()
      .from(content)
      .where(inArray(content.id, contentIds));

    // Fetch genres
    const genreRows = await db
      .select({
        contentId: contentGenres.contentId,
        id: genres.id,
        name: genres.name,
        slug: genres.slug,
      })
      .from(contentGenres)
      .innerJoin(genres, eq(contentGenres.genreId, genres.id))
      .where(inArray(contentGenres.contentId, contentIds));

    const genresByContent = genreRows.reduce<Record<number, any[]>>((acc, row) => {
      if (!acc[row.contentId]) acc[row.contentId] = [];
      acc[row.contentId].push({ id: row.id, name: row.name, slug: row.slug });
      return acc;
    }, {});

    const contentMap = new Map(contentList.map((c) => [c.id, c]));

    const enrichedItems = pItems
      .map((pi) => {
        const item = contentMap.get(pi.contentId);
        if (!item) return null;
        return {
          ...item,
          genres: genresByContent[item.id] || [],
          playlistItemId: pi.id,
          position: pi.position,
          addedAt: pi.addedAt,
        };
      })
      .filter(Boolean);

    return successResponse({ playlist, items: enrichedItems });
  } catch (err) {
    console.error("[Playlist ID GET Error]:", err);
    return internalErrorResponse();
  }
}

/**
 * PATCH /api/playlists/[id]
 * Update playlist details (name, description, isPublic)
 */
export async function PATCH(
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
    const { name, description, isPublic } = body;

    const [updated] = await db
      .update(playlists)
      .set({
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        isPublic: isPublic !== undefined ? Boolean(isPublic) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
      .returning();

    if (!updated) return notFoundResponse("Playlist not found");

    return successResponse(updated);
  } catch (err) {
    console.error("[Playlist PATCH Error]:", err);
    return internalErrorResponse();
  }
}

/**
 * DELETE /api/playlists/[id]
 * Delete playlist
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

    const deleted = await db
      .delete(playlists)
      .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
      .returning();

    if (deleted.length === 0) return notFoundResponse("Playlist not found");

    return successResponse(null);
  } catch (err) {
    console.error("[Playlist DELETE Error]:", err);
    return internalErrorResponse();
  }
}
