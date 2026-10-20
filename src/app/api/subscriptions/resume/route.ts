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
      return validationErrorResponse("No subscription found.");
    }

    if (sub.status === "active") {
      return validationErrorResponse("Subscription is already active.");
    }

    const [updated] = await db
      .update(subscriptions)
      .set({
        status: "active",
        pausedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id))
      .returning();

    return successResponse({
      message: "Subscription successfully resumed! Full streaming access restored.",
      subscription: updated,
    });
  } catch (err) {
    console.error("Resume subscription error:", err);
    return internalErrorResponse();
  }
}
