import { NextRequest } from "next/server";
import { db } from "@/db";
import { loginHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/auth/login-history
 * Fetch audit trail of recent logins for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "Web Client";

    let history = await db
      .select()
      .from(loginHistory)
      .where(eq(loginHistory.userId, userId))
      .orderBy(desc(loginHistory.attemptedAt))
      .limit(15);

    // If empty, seed current active session record
    if (history.length === 0) {
      const [currentRecord] = await db
        .insert(loginHistory)
        .values({
          userId,
          ipAddress: ip,
          location: "Current Location",
          userAgent,
          status: "success",
        })
        .returning();

      history = [currentRecord];
    }

    return successResponse({ history });
  } catch (err) {
    console.error("[Login History GET Error]:", err);
    return internalErrorResponse();
  }
}
