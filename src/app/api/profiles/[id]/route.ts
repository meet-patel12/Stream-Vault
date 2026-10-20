import { NextRequest } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import bcrypt from "bcryptjs";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
  validationErrorResponse,
} from "@/lib/api-response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void request;
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const profileId = parseInt(id);
    const userId = parseInt(session.sub);

    const [existing] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!existing) return notFoundResponse("Profile not found.");

    await db.delete(profiles).where(eq(profiles.id, profileId));

    return successResponse({ message: "Profile deleted." });
  } catch (err) {
    console.error("Delete profile error:", err);
    return internalErrorResponse();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const profileId = parseInt(id);
    const userId = parseInt(session.sub);
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!existing) return notFoundResponse("Profile not found.");

    const updateData: Partial<typeof profiles.$inferInsert> = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.avatarColor !== undefined) updateData.avatarColor = body.avatarColor;
    if (body.avatarEmoji !== undefined) updateData.avatarEmoji = body.avatarEmoji;
    if (body.isKids !== undefined) updateData.isKids = body.isKids;
    if (body.preferredLanguage !== undefined) updateData.preferredLanguage = body.preferredLanguage;
    if (body.preferredAudio !== undefined) updateData.preferredAudio = body.preferredAudio;
    if (body.preferredSubtitle !== undefined) updateData.preferredSubtitle = body.preferredSubtitle;
    if (body.autoplayPreviews !== undefined) updateData.autoplayPreviews = body.autoplayPreviews;

    // PIN management: set new PIN or remove PIN
    if (body.pin !== undefined) {
      if (body.pin === "" || body.pin === null) {
        updateData.pinHash = null;
        updateData.isLocked = false;
      } else if (/^\d{4}$/.test(body.pin)) {
        updateData.pinHash = await bcrypt.hash(body.pin, 10);
        updateData.isLocked = true;
      } else {
        return validationErrorResponse("PIN must be exactly 4 digits.");
      }
    }

    if (body.isLocked !== undefined && body.pin === undefined) {
      // Only allow locking if profile has a pin
      if (body.isLocked && !existing.pinHash) {
        return validationErrorResponse("Cannot lock profile without configuring a 4-digit PIN first.");
      }
      updateData.isLocked = body.isLocked;
    }

    const [updated] = await db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.id, profileId))
      .returning();

    const { pinHash: _, ...safeProfile } = updated;
    return successResponse(safeProfile);
  } catch (err) {
    console.error("Update profile error:", err);
    return internalErrorResponse();
  }
}
