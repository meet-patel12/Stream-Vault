import { NextRequest } from "next/server";
import { getSessionOrRefresh } from "@/lib/auth";
import { validatePlaybackAccess } from "@/lib/playback-auth";
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  internalErrorResponse,
  rateLimitResponse,
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/stream/playback-auth
 * Gatekeeper for media streaming:
 * - Validates JWT & Active Subscription
 * - Validates Parental Controls & Content Maturity
 * - Validates Concurrent Screen Limits
 * - Returns temporary HMAC-SHA256 signed Cloudflare CDN streaming URLs
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "api");
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const body = await request.json().catch(() => null);
    if (!body || !body.contentId) {
      return validationErrorResponse("contentId is required.");
    }

    const contentId = parseInt(body.contentId, 10);
    const profileId = body.profileId ? parseInt(body.profileId, 10) : 1;

    // Extract client IP and Geolocation
    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "127.0.0.1";
    const countryCode = request.headers.get("cf-ipcountry") || undefined;

    const authResult = await validatePlaybackAccess({
      userId: Number(session.sub),
      profileId,
      contentId,
      clientIp,
      countryCode,
    });

    if (!authResult.allowed) {
      return forbiddenResponse(authResult.errorMessage || "Playback authorization denied.", authResult.errorCode);
    }

    return successResponse(
      {
        token: authResult.token,
        expiresIn: authResult.expiresIn,
        hlsUrl: authResult.hlsUrl,
        dashUrl: authResult.dashUrl,
        spriteUrl: authResult.spriteUrl,
        sessionLimit: authResult.sessionLimit,
      },
      200,
      {
        rateLimit: rl,
        cache: { maxAge: 0 }, // Never cache authorization responses
      }
    );
  } catch (err) {
    console.error("[Playback Auth Error]:", err);
    return internalErrorResponse();
  }
}
