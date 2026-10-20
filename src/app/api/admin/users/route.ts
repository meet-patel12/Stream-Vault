import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        plan: users.plan,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return successResponse({ users: userList });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("Admin users fetch error:", err);
    return internalErrorResponse();
  }
}
