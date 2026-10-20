import { NextRequest } from "next/server";
import { db } from "@/db";
import { content, contentGenres, genres } from "@/db/schema";
import { eq, and, desc, inArray, lt } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  rateLimitResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { cachedQuery } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, "api");
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "all";
    const featured = searchParams.get("featured") ?? "false";
    const genre = searchParams.get("genre") ?? "all";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 60);
    const cursor = searchParams.get("cursor") ? parseInt(searchParams.get("cursor")!, 10) : null;
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const sort = searchParams.get("sort") ?? "newest";
    const fieldsParam = searchParams.get("fields");
    const fields = fieldsParam ? fieldsParam.split(",").map((f) => f.trim()) : undefined;

    const cacheKey = `content:v3:${type}:${featured}:${genre}:${limit}:${cursor ?? offset}:${sort}`;

    const { items, nextCursor, total } = await cachedQuery(cacheKey, 180, async () => {
      // Build base filters
      const filters = [eq(content.isPublished, true)];

      if (type === "movie" || type === "series") {
        filters.push(eq(content.type, type));
      }
      if (featured === "true") {
        filters.push(eq(content.isFeatured, true));
      }
      if (cursor) {
        filters.push(lt(content.id, cursor));
      }

      let contentIds: number[] | null = null;
      if (genre !== "all") {
        const [genreRecord] = await db
          .select({ id: genres.id })
          .from(genres)
          .where(eq(genres.slug, genre))
          .limit(1);

        if (genreRecord) {
          const cg = await db
            .select({ contentId: contentGenres.contentId })
            .from(contentGenres)
            .where(eq(contentGenres.genreId, genreRecord.id));
          contentIds = cg.map((r) => r.contentId);

          if (contentIds.length === 0) {
            return { items: [], nextCursor: null, total: 0 };
          }
        }
      }

      const baseFilters =
        contentIds !== null
          ? [...filters, inArray(content.id, contentIds)]
          : filters;

      let queryBuilder = db
        .select()
        .from(content)
        .where(and(...baseFilters));

      // Sorting
      if (sort === "rating") {
        queryBuilder = queryBuilder.orderBy(desc(content.imdbRating), desc(content.id)) as any;
      } else {
        queryBuilder = queryBuilder.orderBy(desc(content.id)) as any;
      }

      const fetchedItems = await queryBuilder
        .limit(limit + 1)
        .offset(cursor ? 0 : offset);

      const hasMore = fetchedItems.length > limit;
      const resultItems = hasMore ? fetchedItems.slice(0, limit) : fetchedItems;
      const nextC = hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1].id : null;

      // Attach genres
      const itemIds = resultItems.map((i) => i.id);
      const genreJoins =
        itemIds.length > 0
          ? await db
              .select({
                contentId: contentGenres.contentId,
                genreId: genres.id,
                genreName: genres.name,
                genreSlug: genres.slug,
              })
              .from(contentGenres)
              .innerJoin(genres, eq(contentGenres.genreId, genres.id))
              .where(inArray(contentGenres.contentId, itemIds))
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

      const enriched = resultItems.map((item) => ({
        ...item,
        genres: genresByContent[item.id] ?? [],
      }));

      return {
        items: enriched,
        nextCursor: nextC,
        total: enriched.length,
      };
    });

    return successResponse(
      {
        items,
        nextCursor,
        total,
      },
      200,
      {
        fields,
        cache: {
          maxAge: 60,
          sMaxAge: 180,
          staleWhileRevalidate: 86400,
        },
        rateLimit: rl,
        req: request,
      }
    );
  } catch (err) {
    console.error("Content list error:", err);
    return internalErrorResponse();
  }
}
