import { NextRequest } from "next/server";
import { db } from "@/db";
import { playlists, playlistItems, content, contentGenres, genres, profiles } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/playlists/shared/[shareToken]
 * Public endpoint to fetch a shared playlist and its items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;

    const [playlist] = await db
      .select({
        id: playlists.id,
        name: playlists.name,
        description: playlists.description,
        type: playlists.type,
        isPublic: playlists.isPublic,
        shareToken: playlists.shareToken,
        profileId: playlists.profileId,
        createdAt: playlists.createdAt,
      })
      .from(playlists)
      .where(eq(playlists.shareToken, shareToken))
      .limit(1);

    if (!playlist || !playlist.isPublic) {
      return notFoundResponse("Shared playlist not found or is private.");
    }

    // Fetch curator profile name
    const [curator] = await db
      .select({
        name: profiles.name,
        avatarColor: profiles.avatarColor,
        avatarEmoji: profiles.avatarEmoji,
      })
      .from(profiles)
      .where(eq(profiles.id, playlist.profileId))
      .limit(1);

    // Fetch items
    const pItems = await db
      .select()
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlist.id))
      .orderBy(playlistItems.position);

    if (pItems.length === 0) {
      return successResponse({
        playlist: { ...playlist, curator: curator || null },
        items: [],
      });
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
          position: pi.position,
        };
      })
      .filter(Boolean);

    return successResponse({
      playlist: { ...playlist, curator: curator || null },
      items: enrichedItems,
    });
  } catch (err) {
    console.error("[Shared Playlist GET Error]:", err);
    return internalErrorResponse();
  }
}
