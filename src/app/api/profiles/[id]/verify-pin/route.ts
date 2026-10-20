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
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const profileId = parseInt(id, 10);
    const userId = parseInt(session.sub, 10);

    const body = await request.json();
    const { pin } = body;

    if (!pin || typeof pin !== "string") {
      return validationErrorResponse("PIN is required.");
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return notFoundResponse("Profile not found.");

    if (!profile.pinHash) {
      // Profile is not PIN protected
      return successResponse({ verified: true, message: "Profile is not locked." });
    }

    const isValid = await bcrypt.compare(pin, profile.pinHash);
    if (!isValid) {
      return validationErrorResponse("Incorrect PIN. Please try again.");
    }

    return successResponse({ verified: true, profileId: profile.id });
  } catch (err) {
    console.error("PIN verification error:", err);
    return internalErrorResponse();
  }
}
