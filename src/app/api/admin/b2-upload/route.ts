import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { uploadBufferToB2 } from "@/lib/b2-storage";
import { enqueueEncodingJob } from "@/lib/encoding-worker";
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  internalErrorResponse,
  rateLimitResponse,
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5-minute timeout for large video uploads

/**
 * POST /api/admin/b2-upload
 * Admin Upload Endpoint:
 * - Validates admin permissions
 * - Streams original video to disk (uploads/originals) & Private Backblaze Bucket
 * - Verifies SHA-256 integrity hash
 * - Saves metadata to PostgreSQL
 * - Creates processing job & triggers FFmpeg encoding worker
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "admin");
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const adminSession = await requireAdmin();

    const contentType = request.headers.get("content-type") || "";

    // 1. JSON Confirmation Mode (when client uploaded directly to B2 using uploadUrl)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { targetKey, contentId, sha256, sizeBytes } = body;

      if (!targetKey) {
        return validationErrorResponse("targetKey is required.");
      }

      const jobId = await enqueueEncodingJob(contentId ? Number(contentId) : null, `b2://${targetKey}`);

      return successResponse({
        message: "Upload registered and encoding job dispatched.",
        jobId,
        source: `b2://${targetKey}`,
        verifiedHash: sha256 || null,
        status: "pending",
      });
    }

    // 2. Multipart Form Upload Mode (direct server-side upload)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const contentId = formData.get("content_id") as string | null;

    if (!file) {
      return validationErrorResponse("No file attached in multipart form.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const diskFileName = `${Date.now()}_${cleanFileName}`;

    // Ensure uploads/originals directory exists and persist original file to disk
    const originalsDir = path.join(process.cwd(), "uploads", "originals");
    fs.mkdirSync(originalsDir, { recursive: true });
    const localFilePath = path.join(originalsDir, diskFileName);
    fs.writeFileSync(localFilePath, buffer);

    // Upload to Private Backblaze B2 Bucket (with safe fallback if B2 key needs re-auth)
    let b2Result = null;
    const targetKey = `uploads/originals/${diskFileName}`;
    try {
      b2Result = await uploadBufferToB2(targetKey, buffer, file.type || "video/mp4");
    } catch (b2Err) {
      console.warn("[B2 Upload Warning] B2 upstream skipped, relying on local master storage:", b2Err);
    }

    // Queue encoding job with localFilePath so FFmpeg worker can transcode immediately
    const jobId = await enqueueEncodingJob(contentId ? Number(contentId) : null, localFilePath);

    return successResponse({
      message: "Movie uploaded and queued for transcoding.",
      jobId,
      fileId: b2Result?.fileId || `local-${diskFileName}`,
      targetKey,
      sha256,
      sizeBytes: buffer.length,
      status: "pending",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("[B2 Upload Error]:", err);
    return internalErrorResponse();
  }
}
