import { NextRequest } from "next/server";
import { db } from "@/db";
import { content, contentGenres, genres, episodes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { cachedQuery } from "@/lib/cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  void request;
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { slug } = await params;

    const detailedItem = await cachedQuery(`content:slug:${slug}`, 300, async () => {
      const [item] = await db
        .select()
        .from(content)
        .where(and(eq(content.slug, slug), eq(content.isPublished, true)))
        .limit(1);

      if (!item) return null;

      // Get genres
      const itemGenres = await db
        .select({
          id: genres.id,
          name: genres.name,
          slug: genres.slug,
        })
        .from(contentGenres)
        .innerJoin(genres, eq(contentGenres.genreId, genres.id))
        .where(eq(contentGenres.contentId, item.id));

      // Get episodes for series
      let eps: typeof episodes.$inferSelect[] = [];
      if (item.type === "series") {
        eps = await db
          .select()
          .from(episodes)
          .where(eq(episodes.contentId, item.id))
          .orderBy(episodes.seasonNumber, episodes.episodeNumber);
      }

      return {
        ...item,
        genres: itemGenres,
        episodes: eps,
      };
    });

    if (!detailedItem) return notFoundResponse("Content not found.");

    return successResponse(detailedItem);
  } catch (err) {
    console.error("Content detail error:", err);
    return internalErrorResponse();
  }
}
