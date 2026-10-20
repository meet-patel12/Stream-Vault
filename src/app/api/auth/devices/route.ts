import { NextRequest } from "next/server";
import { db } from "@/db";
import { userDevices, users, refreshTokens } from "@/db/schema";
import { eq, and, ne, desc, sql } from "drizzle-orm";
import { getSessionOrRefresh, revokeAllUserRefreshTokens } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/auth/devices
 * List all active/registered devices for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const userAgent = request.headers.get("user-agent") || "Web Browser";
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

    let devices = await db
      .select()
      .from(userDevices)
      .where(and(eq(userDevices.userId, userId), eq(userDevices.isRevoked, false)))
      .orderBy(desc(userDevices.lastActiveAt));

    // If no devices registered yet, register this current session
    if (devices.length === 0) {
      const isMobile = /mobile|iphone|android|ipad/i.test(userAgent);
      const isTablet = /ipad|tablet/i.test(userAgent);
      const isTv = /smart-tv|tizen|webos|appletv/i.test(userAgent);
      const deviceType = isTv ? "tv" : isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

      const deviceName = isTv
        ? "Smart TV / Streaming Box"
        : isMobile
        ? "Mobile Device"
        : "Desktop Browser (Chrome / Edge / Safari)";

      const [currentDev] = await db
        .insert(userDevices)
        .values({
          userId,
          deviceName,
          deviceType,
          ipAddress: ip.split(",")[0].trim(),
          userAgent,
          isCurrent: true,
          isRevoked: false,
        })
        .returning();

      devices = [currentDev];
    }

    return successResponse({ devices });
  } catch (err) {
    console.error("[Devices GET Error]:", err);
    return internalErrorResponse();
  }
}

/**
 * DELETE /api/auth/devices?id=... | ?revokeAllOthers=true
 * Device revocation & session invalidation
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const { searchParams } = new URL(request.url);
    const revokeAllOthers = searchParams.get("revokeAllOthers") === "true";
    const deviceIdStr = searchParams.get("id");

    if (revokeAllOthers) {
      // Mark all other devices as revoked
      await db
        .update(userDevices)
        .set({ isRevoked: true })
        .where(and(eq(userDevices.userId, userId), eq(userDevices.isCurrent, false)));

      // Invalidate refresh tokens and bump token version
      await db
        .update(users)
        .set({
          refreshTokenVersion: sql`${users.refreshTokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return successResponse({
        message: "Signed out of all other devices successfully.",
      });
    }

    if (!deviceIdStr) {
      return validationErrorResponse("Provide device id or revokeAllOthers=true");
    }

    const deviceId = parseInt(deviceIdStr, 10);

    await db
      .update(userDevices)
      .set({ isRevoked: true })
      .where(and(eq(userDevices.id, deviceId), eq(userDevices.userId, userId)));

    return successResponse({ message: "Device revoked successfully." });
  } catch (err) {
    console.error("[Devices DELETE Error]:", err);
    return internalErrorResponse();
  }
}
