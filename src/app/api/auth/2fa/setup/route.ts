import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  generateBase32Secret,
  generateBackupCodes,
  buildOtpAuthUrl,
} from "@/lib/totp";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/auth/2fa/setup
 * Initiates TOTP 2FA setup: generates secret & backup codes
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return unauthorizedResponse("User not found");

    const secret = generateBase32Secret(20);
    const backupCodes = generateBackupCodes(8);
    const otpauthUrl = buildOtpAuthUrl(user.email, secret, "StreamVault");

    // Save secret and backup codes (unconfirmed until verified)
    await db
      .update(users)
      .set({
        twoFactorSecret: secret,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
      })
      .where(eq(users.id, userId));

    return successResponse({
      secret,
      otpauthUrl,
      backupCodes,
      qrCodeData: otpauthUrl,
    });
  } catch (err) {
    console.error("[2FA Setup Error]:", err);
    return internalErrorResponse();
  }
}
