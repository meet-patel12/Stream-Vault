import { NextRequest } from "next/server";
import { db } from "@/db";
import { watchHistory, profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

// Save/update watch progress
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`progress:${ip}`, RATE_LIMITS.progress);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { message: "Too many progress updates.", code: "RATE_LIMITED" } },
      { status: 429 }
    );
  }

  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { profileId, contentId, episodeId, progressSeconds, totalSeconds } = body;

    if (!profileId || !contentId || progressSeconds === undefined) {
      return validationErrorResponse("profileId, contentId, and progressSeconds are required.");
    }

    const userId = parseInt(session.sub);

    // Verify profile belongs to user
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found.");

    const completed = totalSeconds
      ? progressSeconds / totalSeconds > 0.9
      : false;

    // Upsert watch history
    const existing = await db
      .select({ id: watchHistory.id })
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, profileId),
          eq(watchHistory.contentId, contentId),
          episodeId
            ? eq(watchHistory.episodeId, episodeId)
            : eq(watchHistory.episodeId, watchHistory.episodeId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(watchHistory)
        .set({
          progressSeconds,
          totalSeconds: totalSeconds ?? null,
          completed,
          updatedAt: new Date(),
        })
        .where(eq(watchHistory.id, existing[0].id));
    } else {
      await db.insert(watchHistory).values({
        profileId,
        contentId,
        episodeId: episodeId ?? null,
        progressSeconds,
        totalSeconds: totalSeconds ?? null,
        completed,
      });
    }

    return successResponse({ saved: true });
  } catch (err) {
    console.error("Progress save error:", err);
    return internalErrorResponse();
  }
}

// Get watch history for a profile
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const profileId = parseInt(searchParams.get("profileId") ?? "0");

    if (!profileId) return validationErrorResponse("profileId is required.");

    const userId = parseInt(session.sub);

    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found.");

    const history = await db
      .select()
      .from(watchHistory)
      .where(eq(watchHistory.profileId, profileId))
      .orderBy(watchHistory.updatedAt);

    return successResponse(history);
  } catch (err) {
    console.error("Progress get error:", err);
    return internalErrorResponse();
  }
}
