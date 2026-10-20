import { NextRequest } from "next/server";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
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
      return validationErrorResponse("No active subscription found.");
    }

    const [updated] = await db
      .update(subscriptions)
      .set({
        status: "canceled",
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id))
      .returning();

    // Downgrade users table to basic free tier
    await db.update(users).set({ plan: "basic" }).where(eq(users.id, userId));

    return successResponse({
      message: "Subscription canceled. Access will remain until the end of your paid billing period.",
      subscription: updated,
    });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return internalErrorResponse();
  }
}
