import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  setAuthCookies,
  type JWTPayload,
} from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function POST(request: NextRequest) {
  void request;
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) return unauthorizedResponse("No refresh token provided.");

    const result = await verifyRefreshToken(refreshToken);
    if (!result) return unauthorizedResponse("Invalid or expired refresh token.");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, result.userId))
      .limit(1);

    if (!user) return unauthorizedResponse();

    // Rotate refresh token (invalidate old, issue new)
    await revokeRefreshToken(refreshToken);
    const newRefreshToken = await generateRefreshToken();
    await storeRefreshToken(user.id, newRefreshToken);

    const jwtPayload: JWTPayload = {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      plan: user.plan,
    };

    const newAccessToken = await generateAccessToken(jwtPayload);
    await setAuthCookies(newAccessToken, newRefreshToken);

    return successResponse({ message: "Token refreshed successfully." });
  } catch (err) {
    console.error("Refresh error:", err);
    return internalErrorResponse();
  }
}
