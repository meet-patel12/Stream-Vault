import { NextRequest } from "next/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function POST(request: NextRequest) {
  void request;
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!sub) {
      return validationErrorResponse("No active subscription found to pause.");
    }

    if (sub.status === "paused") {
      return validationErrorResponse("Subscription is already paused.");
    }

    const [updated] = await db
      .update(subscriptions)
      .set({
        status: "paused",
        pausedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id))
      .returning();

    return successResponse({
      message: "Subscription successfully paused. You can resume anytime without penalty.",
      subscription: updated,
    });
  } catch (err) {
    console.error("Pause subscription error:", err);
    return internalErrorResponse();
  }
}
