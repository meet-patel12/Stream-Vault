import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  void request;
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub);
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        plan: users.plan,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return unauthorizedResponse();

    const userProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));

    return successResponse({ user, profiles: userProfiles });
  } catch (err) {
    console.error("Me error:", err);
    return internalErrorResponse();
  }
}
