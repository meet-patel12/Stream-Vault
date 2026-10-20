import crypto from "crypto";
import { isB2Key, getB2ProxyUrl } from "@/lib/b2-storage";

const CDN_SECRET =
  process.env.CDN_SECRET_KEY ?? "cdn-secret-change-in-production";
const CDN_BASE_URL = process.env.CDN_BASE_URL ?? "";
const SIGNED_URL_TTL = 3600; // 1 hour

/**
 * Generate a signed URL for CDN content delivery.
 * In production this would generate AWS CloudFront signed URLs.
 * For demo purposes, we generate HMAC-signed URLs served through our API.
 */
export function generateSignedUrl(
  key: string,
  expiresInSeconds = SIGNED_URL_TTL
): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const toSign = `${key}:${expires}`;
  const signature = crypto
    .createHmac("sha256", CDN_SECRET)
    .update(toSign)
    .digest("hex");

  if (CDN_BASE_URL) {
    return `${CDN_BASE_URL}/${key}?expires=${expires}&sig=${signature}`;
  }

  // Fallback: serve through our own API route
  return `/api/stream/${encodeURIComponent(key)}?expires=${expires}&sig=${signature}`;
}

export function verifySignedUrl(
  key: string,
  expires: number,
  signature: string
): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (now > expires) return false;

  const toSign = `${key}:${expires}`;
  const expectedSig = crypto
    .createHmac("sha256", CDN_SECRET)
    .update(toSign)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSig, "hex")
  );
}

/**
 * Generate a signed URL for demo video content.
 * Maps content videoKeys to sample HLS streams or B2 Cloud Storage proxy.
 */
export function getDemoVideoUrl(videoKey: string): string {
  // Check if key is for Backblaze B2 Cloud Storage
  if (isB2Key(videoKey)) {
    return getB2ProxyUrl(videoKey);
  }

  // Route local media files (/videos/...) through live streaming & resolution scaling API
  if (videoKey.startsWith("/videos/") || videoKey.startsWith("videos/")) {
    const cleanKey = videoKey.startsWith("/") ? videoKey : `/${videoKey}`;
    return `/api/stream/media?file=${encodeURIComponent(cleanKey)}`;
  }

  if (
    videoKey.startsWith("/") ||
    videoKey.startsWith("http://") ||
    videoKey.startsWith("https://")
  ) {
    return videoKey;
  }

  const demoStreams: Record<string, string> = {
    default: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    action: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    drama: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  };

  return demoStreams[videoKey] ?? demoStreams.default;
}

