import { NextRequest } from "next/server";
import { db } from "@/db";
import { comments, profiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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

    const items = await db
      .select({
        id: comments.id,
        text: comments.text,
        createdAt: comments.createdAt,
        profileId: comments.profileId,
        profileName: profiles.name,
        profileAvatar: profiles.avatarColor,
        profileEmoji: profiles.avatarEmoji,
      })
      .from(comments)
      .innerJoin(profiles, eq(comments.profileId, profiles.id))
      .where(eq(comments.contentId, Number(contentId)))
      .orderBy(desc(comments.createdAt));

    return successResponse({ comments: items });
  } catch (err: unknown) {
    console.error("Get comments error:", err);
    return internalErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { profileId, contentId, text: commentText } = body;

    if (!profileId || !contentId || !commentText || !commentText.trim()) {
      return errorResponse("profileId, contentId, and comment text are required", 400);
    }

    const created = await db
      .insert(comments)
      .values({
        profileId: Number(profileId),
        contentId: Number(contentId),
        text: commentText.trim(),
      })
      .returning();

    return successResponse({ comment: created[0] }, 201);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    console.error("Post comment error:", err);
    return internalErrorResponse();
  }
}
