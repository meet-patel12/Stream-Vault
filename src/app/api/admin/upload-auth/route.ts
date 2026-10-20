import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getB2UploadUrl, getB2Config } from "@/lib/b2-storage";
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalErrorResponse,
  rateLimitResponse,
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/admin/upload-auth
 * Generates temporary Backblaze B2 upload authorization credentials.
 * Secures the master application key and bucket ID from client exposure.
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "admin");
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const adminSession = await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const rawFileName = body.fileName || `source_${Date.now()}.mp4`;
    const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const targetKey = `uploads/originals/${Date.now()}_${cleanFileName}`;

    try {
      const b2Credentials = await getB2UploadUrl();
      return successResponse({
        mode: "direct_b2",
        uploadUrl: b2Credentials.uploadUrl,
        authorizationToken: b2Credentials.authorizationToken,
        targetKey,
        maxSizeBytes: 50 * 1024 * 1024 * 1024, // 50GB limit
      });
    } catch (b2Err) {
      console.warn("[Upload Auth] Direct B2 authorization returned fallback:", (b2Err as Error).message);
      // Fallback: provide internal proxied upload endpoint
      return successResponse({
        mode: "proxied",
        uploadUrl: "/api/admin/b2-upload",
        targetKey,
        maxSizeBytes: 10 * 1024 * 1024 * 1024,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("[Upload Auth Error]:", err);
    return internalErrorResponse();
  }
}
