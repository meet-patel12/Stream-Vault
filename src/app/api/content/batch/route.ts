import { NextRequest } from "next/server";
import { db } from "@/db";
import { content, contentGenres, genres } from "@/db/schema";
import { inArray, eq } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  rateLimitResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { cachedQuery } from "@/lib/cache";

/**
 * POST /api/content/batch
 * Batch content fetcher for lists, carousels, and client sync.
 * Body: { ids: number[], fields?: string[] }
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "api");
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
      return validationErrorResponse("Provide an array of content IDs.");
    }

    const ids: number[] = body.ids
      .map((id: any) => parseInt(id, 10))
      .filter((id: number) => !isNaN(id) && id > 0)
      .slice(0, 50); // Cap at 50 to prevent abuse

    if (ids.length === 0) {
      return successResponse({ items: [] });
    }

    const sortedIdsKey = [...ids].sort((a, b) => a - b).join(",");
    const cacheKey = `content:batch:${sortedIdsKey}`;

    const items = await cachedQuery(cacheKey, 300, async () => {
      const records = await db
        .select()
        .from(content)
        .where(inArray(content.id, ids));

      if (records.length === 0) return [];

      const foundIds = records.map((r) => r.id);
      const genreJoins = await db
        .select({
          contentId: contentGenres.contentId,
          genreId: genres.id,
          genreName: genres.name,
          genreSlug: genres.slug,
        })
        .from(contentGenres)
        .innerJoin(genres, eq(contentGenres.genreId, genres.id))
        .where(inArray(contentGenres.contentId, foundIds));

      const genresByContent = genreJoins.reduce<
        Record<number, { id: number; name: string; slug: string }[]>
      >((acc, row) => {
        if (!acc[row.contentId]) acc[row.contentId] = [];
        if (!acc[row.contentId].some((g) => g.id === row.genreId)) {
          acc[row.contentId].push({ id: row.genreId, name: row.genreName, slug: row.genreSlug });
        }
        return acc;
      }, {});

      return records.map((item) => ({
        ...item,
        genres: genresByContent[item.id] || [],
      }));
    });

    return successResponse(
      { items, count: items.length },
      200,
      {
        fields: body.fields,
        cache: {
          maxAge: 120,
          sMaxAge: 300,
        },
        rateLimit: rl,
      }
    );
  } catch (err) {
    console.error("Batch content error:", err);
    return internalErrorResponse();
  }
}
