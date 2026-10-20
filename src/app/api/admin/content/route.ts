import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content, contentGenres, genres } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalErrorResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const items = await db.select().from(content).orderBy(desc(content.createdAt));

    const itemIds = items.map((i) => i.id);
    const genreJoins =
      itemIds.length > 0
        ? await db
            .select({
              contentId: contentGenres.contentId,
              genreName: genres.name,
            })
            .from(contentGenres)
            .innerJoin(genres, eq(contentGenres.genreId, genres.id))
            .where(inArray(contentGenres.contentId, itemIds))
        : [];

    const genresByContent = genreJoins.reduce<Record<number, string[]>>((acc, row) => {
      if (!acc[row.contentId]) acc[row.contentId] = [];
      acc[row.contentId].push(row.genreName);
      return acc;
    }, {});

    const enriched = items.map((item) => ({
      ...item,
      genres: genresByContent[item.id] ?? [],
    }));

    return successResponse({ items: enriched });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("Admin content fetch error:", err);
    return internalErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const {
      title,
      description,
      type,
      releaseYear,
      maturityRating,
      duration,
      posterUrl,
      backdropUrl,
      videoKey,
      isFeatured,
      isPublished,
      imdbRating,
    } = body;

    if (!title) {
      return validationErrorResponse("Title is required");
    }

    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") + "-" + Date.now();

    const [newItem] = await db
      .insert(content)
      .values({
        title,
        slug,
        description: description || "",
        type: type || "movie",
        releaseYear: releaseYear ? parseInt(releaseYear) : new Date().getFullYear(),
        maturityRating: maturityRating || "PG-13",
        duration: duration ? parseInt(duration) : 120,
        posterUrl: posterUrl || "/posters/default.jpg",
        backdropUrl: backdropUrl || "/backdrops/default.jpg",
        videoKey: videoKey || null,
        isFeatured: Boolean(isFeatured),
        isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
        imdbRating: imdbRating ? parseFloat(imdbRating) : 8.0,
      })
      .returning();

    return successResponse({ item: newItem }, 201);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("Admin content create error:", err);
    return internalErrorResponse();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return validationErrorResponse("Content ID is required");
    }

    await db.delete(content).where(eq(content.id, parseInt(id)));

    return successResponse({ message: "Content deleted successfully" });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("Admin content delete error:", err);
    return internalErrorResponse();
  }
}
