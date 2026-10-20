import { NextRequest } from "next/server";
import { db } from "@/db";
import { notifications, profiles } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/notifications?profileId=...
 * Fetch user & profile notifications with unread count
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const { searchParams } = new URL(request.url);
    const profileIdStr = searchParams.get("profileId");
    const profileId = profileIdStr ? parseInt(profileIdStr, 10) : null;

    let items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    // If user has zero notifications, seed high-quality realistic initial notifications
    if (items.length === 0) {
      await db.insert(notifications).values([
        {
          userId,
          profileId,
          title: "🎉 Welcome to StreamVault 4K HDR",
          message: "Experience cinema-grade streaming with multi-codec AV1 & Dolby Vision support.",
          type: "system",
          actionUrl: "/browse",
          isRead: false,
        },
        {
          userId,
          profileId,
          title: "🔥 New Blockbuster Release: Dune Part Two",
          message: "Now streaming in 4K UHD with immersive multi-audio surround sound.",
          type: "new_release",
          actionUrl: "/browse",
          isRead: false,
        },
        {
          userId,
          profileId,
          title: "⏱️ Don't Forget to Finish Watching",
          message: "You have titles waiting in your Continue Watching row. Jump right back in where you left off.",
          type: "continue_watching",
          actionUrl: "/browse",
          isRead: false,
        },
        {
          userId,
          profileId,
          title: "✨ Personalized Recommendations Ready",
          message: "Our hybrid AI recommendation engine has refreshed your top picks for tonight.",
          type: "recommendation",
          actionUrl: "/browse",
          isRead: false,
        },
      ]);

      items = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(20);
    }

    const unreadCount = items.filter((n) => !n.isRead).length;

    return successResponse({
      notifications: items,
      unreadCount,
    });
  } catch (err) {
    console.error("[Notifications GET Error]:", err);
    return internalErrorResponse();
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 * Body: { id?: number, markAllRead?: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const body = await request.json();
    const { id, markAllRead } = body;

    if (markAllRead) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId));

      return successResponse({ message: "All notifications marked as read" });
    }

    if (id) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.id, parseInt(id, 10)),
            eq(notifications.userId, userId)
          )
        );

      return successResponse({ message: "Notification marked as read" });
    }

    return validationErrorResponse("Provide either id or markAllRead: true");
  } catch (err) {
    console.error("[Notifications PATCH Error]:", err);
    return internalErrorResponse();
  }
}

/**
 * POST /api/notifications
 * Create notification (e.g. for subscription renewals, payment success, new releases)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const body = await request.json();
    const { title, message, type = "system", actionUrl, profileId } = body;

    if (!title || !message) {
      return validationErrorResponse("title and message are required");
    }

    const [created] = await db
      .insert(notifications)
      .values({
        userId,
        profileId: profileId ? parseInt(profileId, 10) : null,
        title: title.trim(),
        message: message.trim(),
        type,
        actionUrl: actionUrl || null,
        isRead: false,
      })
      .returning();

    return successResponse(created);
  } catch (err) {
    console.error("[Notifications POST Error]:", err);
    return internalErrorResponse();
  }
}
