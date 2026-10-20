import { NextRequest } from "next/server";
import { getSessionOrRefresh } from "@/lib/auth";
import { generateSignedUrl, getDemoVideoUrl } from "@/lib/signed-url";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { videoKey } = body;

    if (!videoKey) {
      return validationErrorResponse("videoKey is required.");
    }

    // For demo: return direct HLS URL
    // In production: generate actual CloudFront signed URL
    const signedUrl = generateSignedUrl(videoKey, 3600);
    const directUrl = getDemoVideoUrl(videoKey);

    return successResponse({
      signedUrl,
      directUrl, // fallback for demo
      expiresIn: 3600,
    });
  } catch (err) {
    console.error("Signed URL error:", err);
    return internalErrorResponse();
  }
}
