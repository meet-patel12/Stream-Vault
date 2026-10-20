import { NextRequest } from "next/server";
import { db } from "@/db";
import { content, contentGenres, genres } from "@/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { cachedQuery } from "@/lib/cache";

/**
 * GET /api/content/[slug]/similar?limit=12
 * Advanced content-based vector similarity engine (Genre Jaccard index + Director/Cast overlap + Rating proximity)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "12", 10), 24);

    const cacheKey = `content:similar:${slug}:limit:${limit}`;

    const similarItems = await cachedQuery(cacheKey, 600, async () => {
      // 1. Fetch target item
      const [targetItem] = await db
        .select()
        .from(content)
        .where(and(eq(content.slug, slug), eq(content.isPublished, true)))
        .limit(1);

      if (!targetItem) return null;

      // 2. Fetch target genres
      const targetGenreRows = await db
        .select({
          id: genres.id,
          name: genres.name,
          slug: genres.slug,
        })
        .from(contentGenres)
        .innerJoin(genres, eq(contentGenres.genreId, genres.id))
        .where(eq(contentGenres.contentId, targetItem.id));

      const targetGenreIds = new Set(targetGenreRows.map((g) => g.id));

      // 3. Candidate items (same type or overall published catalog, excluding target)
      const candidates = await db
        .select()
        .from(content)
        .where(and(ne(content.id, targetItem.id), eq(content.isPublished, true)))
        .limit(80);

      if (candidates.length === 0) return [];

      const candidateIds = candidates.map((c) => c.id);

      // Fetch candidate genres
      const candidateGenreRows = await db
        .select({
          contentId: contentGenres.contentId,
          id: genres.id,
          name: genres.name,
          slug: genres.slug,
        })
        .from(contentGenres)
        .innerJoin(genres, eq(contentGenres.genreId, genres.id))
        .where(inArray(contentGenres.contentId, candidateIds));

      const genresByCandidate = candidateGenreRows.reduce<
        Record<number, { id: number; name: string; slug: string }[]>
      >((acc, row) => {
        if (!acc[row.contentId]) acc[row.contentId] = [];
        acc[row.contentId].push({ id: row.id, name: row.name, slug: row.slug });
        return acc;
      }, {});

      // 4. Compute Vector Similarity Score
      const scoredCandidates = candidates.map((cand) => {
        const cGenres = genresByCandidate[cand.id] || [];
        const candGenreIds = new Set(cGenres.map((g) => g.id));

        // Jaccard similarity for genres
        let intersection = 0;
        for (const gid of candGenreIds) {
          if (targetGenreIds.has(gid)) intersection++;
        }
        const union = new Set([...targetGenreIds, ...candGenreIds]).size;
        const genreSimilarity = union > 0 ? intersection / union : 0;

        // Cast overlap
        const targetCast = new Set((targetItem.cast || []).map((c) => c.toLowerCase()));
        let castOverlap = 0;
        for (const actor of cand.cast || []) {
          if (targetCast.has(actor.toLowerCase())) castOverlap++;
        }

        // Director overlap
        const targetDirectors = new Set((targetItem.directors || []).map((d) => d.toLowerCase()));
        let directorOverlap = 0;
        for (const dir of cand.directors || []) {
          if (targetDirectors.has(dir.toLowerCase())) directorOverlap++;
        }

        // Rating proximity (closer rating = higher score)
        const ratingDiff = Math.abs((cand.imdbRating || 0) - (targetItem.imdbRating || 0));
        const ratingProximity = Math.max(0, 1 - ratingDiff / 10);

        // Same type bonus (movie vs series)
        const typeMatch = cand.type === targetItem.type ? 1.0 : 0.4;

        // Weighted composite score (0 - 100)
        const compositeScore =
          genreSimilarity * 45 +
          Math.min(castOverlap * 15, 25) +
          Math.min(directorOverlap * 20, 20) +
          ratingProximity * 15 +
          typeMatch * 10;

        return {
          item: {
            ...cand,
            genres: cGenres,
          },
          similarityScore: Math.round(compositeScore),
        };
      });

      scoredCandidates.sort((a, b) => b.similarityScore - a.similarityScore);

      return scoredCandidates.slice(0, limit).map((s) => s.item);
    });

    if (similarItems === null) {
      return notFoundResponse("Target content not found.");
    }

    return successResponse({
      items: similarItems,
      count: similarItems.length,
      targetSlug: slug,
    });
  } catch (err) {
    console.error("[Similar Content Error]:", err);
    return internalErrorResponse();
  }
}
