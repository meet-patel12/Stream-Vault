import { NextRequest } from "next/server";
import { db } from "@/db";
import { genres } from "@/db/schema";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  rateLimitResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { cachedQuery } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, "api");
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const allGenres = await cachedQuery("catalog:genres:all", 3600, async () => {
      return db.select().from(genres).orderBy(genres.name);
    });

    return successResponse(allGenres, 200, {
      cache: {
        maxAge: 300,
        sMaxAge: 3600,
        staleWhileRevalidate: 86400,
      },
      rateLimit: rl,
      req: request,
    });
  } catch (err) {
    console.error("Genres error:", err);
    return internalErrorResponse();
  }
}
