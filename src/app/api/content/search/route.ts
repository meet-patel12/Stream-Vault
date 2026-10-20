import { NextRequest } from "next/server";
import { db } from "@/db";
import { content, contentGenres, genres } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
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

// Levenshtein distance for fuzzy typo tolerance
function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));
  for (let i = 0; i <= an; ++i) matrix[0][i] = i;
  for (let i = 0; i <= bn; ++i) matrix[i][0] = i;
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * GET /api/content/search
 * Multi-Faceted Instant, Fuzzy & Voice Search API
 */
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, "search");
  if (!rl.allowed) {
    return rateLimitResponse(rl, "Too many search queries. Please wait a moment.");
  }

  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const filterGenre = searchParams.get("genre")?.trim().toLowerCase();
    const filterActor = searchParams.get("actor")?.trim().toLowerCase();
    const filterDirector = searchParams.get("director")?.trim().toLowerCase();
    const filterType = searchParams.get("type")?.trim().toLowerCase();
    const minRating = searchParams.get("minRating") ? parseFloat(searchParams.get("minRating")!) : null;
    const yearMin = searchParams.get("yearMin") ? parseInt(searchParams.get("yearMin")!, 10) : null;
    const yearMax = searchParams.get("yearMax") ? parseInt(searchParams.get("yearMax")!, 10) : null;
    const durationMax = searchParams.get("durationMax") ? parseInt(searchParams.get("durationMax")!, 10) : null;

    if (!q && !filterGenre && !filterActor && !filterDirector && !filterType && !minRating) {
      return validationErrorResponse("Provide a search query or at least one filter criterion.");
    }

    const cleanQuery = q.toLowerCase();
    const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

    const cacheKey = `search:v2:${cleanQuery}:${filterGenre ?? "all"}:${filterType ?? "all"}:${minRating ?? 0}:${yearMin ?? 0}:${yearMax ?? 0}:${durationMax ?? 0}`;

    const searchResults = await cachedQuery(cacheKey, 60, async () => {
      // Fetch catalog
      const allItems = await db
        .select()
        .from(content)
        .where(eq(content.isPublished, true))
        .limit(250);

      const allIds = allItems.map((i) => i.id);
      const genreJoins =
        allIds.length > 0
          ? await db
              .select({
                contentId: contentGenres.contentId,
                genreId: genres.id,
                genreName: genres.name,
                genreSlug: genres.slug,
              })
              .from(contentGenres)
              .innerJoin(genres, eq(contentGenres.genreId, genres.id))
              .where(inArray(contentGenres.contentId, allIds))
          : [];

      const genresByContent = genreJoins.reduce<
        Record<number, { id: number; name: string; slug: string }[]>
      >((acc, row) => {
        if (!acc[row.contentId]) acc[row.contentId] = [];
        acc[row.contentId].push({ id: row.genreId, name: row.genreName, slug: row.genreSlug });
        return acc;
      }, {});

      // Score and filter each item
      const scored = allItems
        .map((item) => {
          const itemGenres = genresByContent[item.id] || [];
          const genreNames = itemGenres.map((g) => g.name.toLowerCase());
          const genreSlugs = itemGenres.map((g) => g.slug.toLowerCase());
          const castLower = (item.cast || []).map((c) => c.toLowerCase());
          const directorsLower = (item.directors || []).map((d) => d.toLowerCase());

          // 1. Hard Filters
          if (filterType && filterType !== "all" && item.type !== filterType) {
            return null;
          }
          if (filterGenre && !genreSlugs.includes(filterGenre) && !genreNames.includes(filterGenre)) {
            return null;
          }
          if (filterActor && !castLower.some((c) => c.includes(filterActor))) {
            return null;
          }
          if (filterDirector && !directorsLower.some((d) => d.includes(filterDirector))) {
            return null;
          }
          if (minRating !== null && (item.imdbRating === null || item.imdbRating < minRating)) {
            return null;
          }
          if (yearMin !== null && item.releaseYear && item.releaseYear < yearMin) {
            return null;
          }
          if (yearMax !== null && item.releaseYear && item.releaseYear > yearMax) {
            return null;
          }
          if (durationMax !== null && item.duration && item.duration > durationMax) {
            return null;
          }

          // 2. Score Calculation
          let score = item.imdbRating || 0; // Baseline rating score

          if (cleanQuery) {
            const titleLower = item.title.toLowerCase();
            const descLower = (item.description || "").toLowerCase();

            // Tier 1: Exact title match
            if (titleLower === cleanQuery) {
              score += 150;
            } else if (titleLower.startsWith(cleanQuery)) {
              score += 100;
            } else if (titleLower.includes(cleanQuery)) {
              score += 70;
            }

            // Tier 2: Token-level matching & Fuzzy Levenshtein
            const titleWords = titleLower.split(/\s+/);
            for (const token of queryTokens) {
              if (titleWords.some((w) => w === token)) {
                score += 30;
              } else if (titleWords.some((w) => levenshtein(w, token) <= 2 && token.length >= 4)) {
                score += 25; // Fuzzy typo match
              }
            }

            // Tier 3: Cast & Director matching
            for (const token of queryTokens) {
              if (castLower.some((c) => c.includes(token))) score += 20;
              if (directorsLower.some((d) => d.includes(token))) score += 18;
            }

            // Tier 4: Genre matching
            for (const token of queryTokens) {
              if (genreNames.some((g) => g.includes(token))) score += 15;
            }

            // Tier 5: Description matching
            if (descLower.includes(cleanQuery)) {
              score += 10;
            }
          } else {
            // If query is empty but filters are set, score by rating & popularity
            score += (item.isFeatured ? 10 : 0);
          }

          return {
            item: {
              ...item,
              genres: itemGenres,
            },
            score,
          };
        })
        .filter((res): res is { item: any; score: number } => res !== null);

      scored.sort((a, b) => b.score - a.score);

      return scored.slice(0, 30).map((s) => s.item);
    });

    return successResponse(
      {
        items: searchResults,
        query: q,
        total: searchResults.length,
        filters: {
          genre: filterGenre,
          type: filterType,
          minRating,
          yearMin,
          yearMax,
          durationMax,
        },
      },
      200,
      {
        cache: {
          maxAge: 30,
          sMaxAge: 120,
          staleWhileRevalidate: 86400,
        },
        rateLimit: rl,
        req: request,
      }
    );
  } catch (err) {
    console.error("Search error:", err);
    return internalErrorResponse();
  }
}
