import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, content, genres } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { successResponse, unauthorizedResponse, forbiddenResponse, internalErrorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [contentCount] = await db.select({ count: sql<number>`count(*)` }).from(content);
    const [moviesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(content)
      .where(eq(content.type, "movie"));
    const [seriesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(content)
      .where(eq(content.type, "series"));
    const [genreCount] = await db.select({ count: sql<number>`count(*)` }).from(genres);

    // Plan distribution
    const plans = await db
      .select({ plan: users.plan, count: sql<number>`count(*)` })
      .from(users)
      .groupBy(users.plan);

    return successResponse({
      stats: {
        totalUsers: Number(userCount?.count ?? 0),
        totalContent: Number(contentCount?.count ?? 0),
        moviesCount: Number(moviesCount?.count ?? 0),
        seriesCount: Number(seriesCount?.count ?? 0),
        genreCount: Number(genreCount?.count ?? 0),
        planBreakdown: plans.map((p) => ({ plan: p.plan, count: Number(p.count) })),
        dbStatus: "connected",
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("Admin stats error:", err);
    return internalErrorResponse();
  }
}
