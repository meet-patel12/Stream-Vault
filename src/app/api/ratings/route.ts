import { NextRequest } from "next/server";
import { db } from "@/db";
import { ratings, content } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("contentId");

    if (!contentId) {
      return errorResponse("contentId query parameter is required", 400);
    }

    const [avgResult] = await db
      .select({
        average: sql<number>`round(avg(${ratings.score})::numeric, 1)`,
        count: sql<number>`count(*)`,
      })
      .from(ratings)
      .where(eq(ratings.contentId, Number(contentId)));

    return successResponse({
      average: Number(avgResult?.average ?? 0),
      totalRatings: Number(avgResult?.count ?? 0),
    });
  } catch (err: unknown) {
    console.error("Get ratings error:", err);
    return internalErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { profileId, contentId, score } = body;

    if (!profileId || !contentId || typeof score !== "number" || score < 1 || score > 5) {
      return errorResponse("profileId, contentId, and score (1-5) are required", 400);
    }

    const existing = await db
      .select()
      .from(ratings)
      .where(
        and(
          eq(ratings.profileId, Number(profileId)),
          eq(ratings.contentId, Number(contentId))
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(ratings)
        .set({ score, updatedAt: new Date() })
        .where(eq(ratings.id, existing[0].id))
        .returning();
      return successResponse({ rating: updated[0] });
    }

    const created = await db
      .insert(ratings)
      .values({
        profileId: Number(profileId),
        contentId: Number(contentId),
        score,
      })
      .returning();

    return successResponse({ rating: created[0] }, 201);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    console.error("Save rating error:", err);
    return internalErrorResponse();
  }
}
