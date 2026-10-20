import { NextRequest } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import bcrypt from "bcryptjs";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  void request;
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub);
    const userProfiles = await db
      .select({
        id: profiles.id,
        userId: profiles.userId,
        name: profiles.name,
        avatarColor: profiles.avatarColor,
        avatarEmoji: profiles.avatarEmoji,
        isKids: profiles.isKids,
        isLocked: profiles.isLocked,
        preferredLanguage: profiles.preferredLanguage,
        preferredAudio: profiles.preferredAudio,
        preferredSubtitle: profiles.preferredSubtitle,
        autoplayPreviews: profiles.autoplayPreviews,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId));

    return successResponse(userProfiles);
  } catch (err) {
    console.error("Get profiles error:", err);
    return internalErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub);
    const body = await request.json();
    const {
      name,
      avatarColor,
      avatarEmoji,
      isKids,
      pin,
      preferredLanguage,
      preferredAudio,
      preferredSubtitle,
      autoplayPreviews,
    } = body;

    if (!name || name.trim().length < 2) {
      return validationErrorResponse("Profile name must be at least 2 characters.");
    }

    // Max 5 profiles per account
    const existing = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, userId));

    if (existing.length >= 5) {
      return errorResponse("Maximum 5 profiles allowed per account.", 400, "MAX_PROFILES");
    }

    let pinHash: string | null = null;
    let isLocked = false;
    if (pin && /^\d{4}$/.test(pin)) {
      pinHash = await bcrypt.hash(pin, 10);
      isLocked = true;
    }

    const [newProfile] = await db
      .insert(profiles)
      .values({
        userId,
        name: name.trim(),
        avatarColor: avatarColor ?? "#E50914",
        avatarEmoji: avatarEmoji ?? "🎬",
        isKids: isKids ?? false,
        pinHash,
        isLocked,
        preferredLanguage: preferredLanguage ?? "en",
        preferredAudio: preferredAudio ?? "original",
        preferredSubtitle: preferredSubtitle ?? "off",
        autoplayPreviews: autoplayPreviews ?? true,
      })
      .returning();

    // Do not return raw pinHash to client
    const { pinHash: _, ...safeProfile } = newProfile;
    return successResponse(safeProfile, 201);
  } catch (err) {
    console.error("Create profile error:", err);
    return internalErrorResponse();
  }
}
