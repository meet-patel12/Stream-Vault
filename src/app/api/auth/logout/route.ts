import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  revokeRefreshToken,
  clearAuthCookies,
} from "@/lib/auth";
import { successResponse, internalErrorResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  void request;
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    await clearAuthCookies();

    return successResponse({ message: "Logged out successfully." });
  } catch (err) {
    console.error("Logout error:", err);
    return internalErrorResponse();
  }
}
