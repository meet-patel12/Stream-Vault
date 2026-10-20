import { NextRequest } from "next/server";
import { db } from "@/db";
import { playlists, playlistItems, profiles, content, contentGenres, genres } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import crypto from "crypto";

/**
 * GET /api/playlists?profileId=...&type=favorites|watch_later|collection|custom
 * List all playlists for active profile
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const profileIdStr = searchParams.get("profileId");
    const typeFilter = searchParams.get("type");

    if (!profileIdStr) return validationErrorResponse("profileId is required.");

    const profileId = parseInt(profileIdStr, 10);
    const userId = parseInt(session.sub, 10);

    // Verify profile ownership
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found.");

    // Query playlists
    const userPlaylists = await db
      .select()
      .from(playlists)
      .where(
        typeFilter
          ? and(eq(playlists.profileId, profileId), eq(playlists.type, typeFilter))
          : eq(playlists.profileId, profileId)
      )
      .orderBy(desc(playlists.createdAt));

    // Get item counts and preview thumbnails for each playlist
    const playlistIds = userPlaylists.map((p) => p.id);

    let itemsByPlaylist: Record<number, any[]> = {};
    if (playlistIds.length > 0) {
      const items = await db
        .select({
          playlistId: playlistItems.playlistId,
          contentId: playlistItems.contentId,
          position: playlistItems.position,
        })
        .from(playlistItems)
        .where(inArray(playlistItems.playlistId, playlistIds))
        .orderBy(playlistItems.position);

      itemsByPlaylist = items.reduce<Record<number, any[]>>((acc, it) => {
        if (!acc[it.playlistId]) acc[it.playlistId] = [];
        acc[it.playlistId].push(it);
        return acc;
      }, {});
    }

    const playlistsWithCounts = userPlaylists.map((p) => ({
      ...p,
      itemCount: itemsByPlaylist[p.id]?.length || 0,
      previewContentIds: (itemsByPlaylist[p.id] || []).slice(0, 4).map((i) => i.contentId),
    }));

    return successResponse({ playlists: playlistsWithCounts });
  } catch (err) {
    console.error("[Playlists GET Error]:", err);
    return internalErrorResponse();
  }
}

/**
 * POST /api/playlists
 * Create new playlist, collection, or list
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { profileId, name, description, type = "custom", isPublic = false } = body;

    if (!profileId || !name || !name.trim()) {
      return validationErrorResponse("profileId and a non-empty name are required.");
    }

    const userId = parseInt(session.sub, 10);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found.");

    const shareToken = crypto.randomBytes(16).toString("hex");

    const [newPlaylist] = await db
      .insert(playlists)
      .values({
        userId,
        profileId,
        name: name.trim(),
        description: description?.trim() || null,
        type,
        isPublic: Boolean(isPublic),
        shareToken,
      })
      .returning();

    return successResponse(newPlaylist);
  } catch (err) {
    console.error("[Playlists POST Error]:", err);
    return internalErrorResponse();
  }
}
