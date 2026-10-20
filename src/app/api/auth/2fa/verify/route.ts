import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import { verifyTOTP } from "@/lib/totp";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/auth/2fa/verify
 * Confirms 6-digit TOTP code and activates Two-Factor Authentication
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const body = await request.json();
    const { code } = body;

    if (!code || code.trim().length !== 6) {
      return validationErrorResponse("Provide a 6-digit TOTP verification code.");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.twoFactorSecret) {
      return validationErrorResponse("2FA has not been initiated. Please start setup first.");
    }

    const isValid = verifyTOTP(code.trim(), user.twoFactorSecret);
    if (!isValid) {
      return validationErrorResponse("Invalid code. Check your authenticator app time and try again.");
    }

    // Activate 2FA
    await db
      .update(users)
      .set({
        twoFactorEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return successResponse({
      twoFactorEnabled: true,
      message: "Two-Factor Authentication is now enabled on your account.",
    });
  } catch (err) {
    console.error("[2FA Verify Error]:", err);
    return internalErrorResponse();
  }
}
