import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import { verifyTOTP } from "@/lib/totp";
import bcrypt from "bcryptjs";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/auth/2fa/disable
 * Disables Two-Factor Authentication after password confirmation or OTP
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const body = await request.json();
    const { password, code } = body;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return unauthorizedResponse("User not found");

    let isAuthorized = false;

    // Check code if supplied
    if (code && user.twoFactorSecret) {
      isAuthorized = verifyTOTP(code.trim(), user.twoFactorSecret);
    }

    // Check password if code wasn't valid or supplied
    if (!isAuthorized && password) {
      isAuthorized = await bcrypt.compare(password, user.passwordHash);
    }

    if (!isAuthorized) {
      return validationErrorResponse("Invalid password or 2FA code.");
    }

    await db
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return successResponse({
      twoFactorEnabled: false,
      message: "Two-factor authentication disabled.",
    });
  } catch (err) {
    console.error("[2FA Disable Error]:", err);
    return internalErrorResponse();
  }
}
