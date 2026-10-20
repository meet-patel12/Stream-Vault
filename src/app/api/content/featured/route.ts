import { NextRequest } from "next/server";
import { db } from "@/db";
import { content, contentGenres, genres } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { cachedQuery } from "@/lib/cache";

export async function GET(request: NextRequest) {
  void request;
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const enriched = await cachedQuery("content:featured:list", 300, async () => {
      const featured = await db
        .select()
        .from(content)
        .where(and(eq(content.isFeatured, true), eq(content.isPublished, true)))
        .limit(5);

      const ids = featured.map((f) => f.id);
      const genreJoins =
        ids.length > 0
          ? await db
              .select({
                contentId: contentGenres.contentId,
                genreId: genres.id,
                genreName: genres.name,
                genreSlug: genres.slug,
              })
              .from(contentGenres)
              .innerJoin(genres, eq(contentGenres.genreId, genres.id))
              .where(inArray(contentGenres.contentId, ids))
          : [];

      const genresByContent = genreJoins.reduce<
        Record<number, { id: number; name: string; slug: string }[]>
      >((acc, row) => {
        if (!acc[row.contentId]) acc[row.contentId] = [];
        if (!acc[row.contentId].some((g) => g.id === row.genreId)) {
          acc[row.contentId].push({ id: row.genreId, name: row.genreName, slug: row.genreSlug });
        }
        return acc;
      }, {});

      return featured.map((item) => ({
        ...item,
        genres: genresByContent[item.id] ?? [],
      }));
    });

    return successResponse(enriched);
  } catch (err) {
    console.error("Featured content error:", err);
    return internalErrorResponse();
  }
}
