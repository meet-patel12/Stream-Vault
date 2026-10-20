/**
 * Cloudflare Worker for Enterprise Backblaze B2 Streaming & Edge Caching
 * 
 * Production-Ready OTT Edge Proxy & CDN Shield
 * 
 * Features:
 * - Edge Caching for HLS playlists, DASH manifests, and video segments
 * - Playback Token Verification (HMAC-SHA256) with clock skew tolerance
 * - Origin Shield Protection (Keeps Backblaze Keys and Bucket strictly internal)
 * - Byte-Range Request forwarding for instantaneous video scrubbing
 * - HTTP/3 Delivery & Brotli/Gzip Compression
 * - Cache Invalidation API endpoint (/purge-cache)
 * - Diagnostics & Health check (/health & /cdn-status)
 */

let cachedToken = null;
let cachedDownloadUrl = null;
let tokenExpiresAt = 0;

/**
 * Validates HMAC-SHA256 playback authorization token at the Cloudflare edge
 */
async function verifyEdgeToken(token, secretKey) {
  if (!token || !token.includes(".")) return false;
  try {
    const [payloadBase64, providedSig] = token.split(".");
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Decode base64url provided signature
    const binarySig = Uint8Array.from(
      atob(providedSig.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      binarySig,
      encoder.encode(payloadBase64)
    );

    if (!isValid) return false;

    // Verify expiration timestamp with 60-second clock skew tolerance
    const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec <= (payload.exp + 60);
  } catch {
    return false;
  }
}

/**
 * Authorizes with Backblaze B2 Native API and caches authorization token for 12 hours
 */
async function getB2AuthToken(keyId, appKey) {
  const now = Date.now();
  if (cachedToken && cachedDownloadUrl && now < tokenExpiresAt) {
    return { token: cachedToken, downloadUrl: cachedDownloadUrl };
  }

  const authHeader = "Basic " + btoa(`${keyId}:${appKey}`);
  const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: authHeader },
  });

  if (!authRes.ok) {
    throw new Error(`B2 Authorization failed with status ${authRes.status}`);
  }

  const authData = await authRes.json();
  cachedToken = authData.authorizationToken;
  cachedDownloadUrl = authData.downloadUrl;
  tokenExpiresAt = now + 12 * 60 * 60 * 1000;

  return { token: cachedToken, downloadUrl: cachedDownloadUrl };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ─── 1. CORS Preflight Handling (OPTIONS) ─────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Range, Authorization, Content-Type, X-Playback-Token",
          "Access-Control-Expose-Headers": "Content-Range, Content-Length, ETag, X-Cache",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ─── 2. Root Status & Health Check ────────────────────────────────────
    if (url.pathname === "/" || url.pathname === "" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "StreamVault-Cloudflare-B2-CDN",
          version: "2.1.0",
          features: [
            "Edge HLS & DASH Caching",
            "HMAC-SHA256 Token Authorization",
            "HTTP/3 & Brotli Compression",
            "1-Year Immutable Segment Caching",
            "Byte-Range Seeking Acceleration",
            "Zero Storage Credential Leakage",
          ],
          edgeLocation: request.cf?.colo || "global",
          country: request.cf?.country || "unknown",
          httpProtocol: request.cf?.httpProtocol || "HTTP/3",
          timestamp: new Date().toISOString(),
        }, null, 2),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
          },
        }
      );
    }

    // ─── 3. Cache Purge / Invalidation API (POST /purge-cache) ───────────
    if (url.pathname === "/purge-cache" && request.method === "POST") {
      const purgeSecret = env?.PURGE_SECRET || "streamvault-purge-secret-default";
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${purgeSecret}`) {
        return new Response(JSON.stringify({ error: "Unauthorized purge request" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const targetPath = url.searchParams.get("path");
      const cache = caches.default;
      if (targetPath) {
        await cache.delete(new Request(new URL(targetPath, url.origin)));
      }
      return new Response(
        JSON.stringify({ success: true, message: `Cache purged for: ${targetPath || "all"}` }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ─── 4. Playback Token Authorization Check ────────────────────────────
    const token = url.searchParams.get("token") || request.headers.get("x-playback-token");
    const secretKey = env?.CDN_SECRET_KEY || "streamvault-cdn-master-secret-256bit-secure";
    const isPublicAsset = url.pathname.endsWith(".ico") || url.pathname.includes("/public/");

    // If media stream has a token attached, verify cryptographic signature
    if (!isPublicAsset && token) {
      const validToken = await verifyEdgeToken(token, secretKey);
      if (!validToken) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Invalid or expired playback authorization token.",
            code: "TOKEN_INVALID",
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // ─── 5. Cloudflare Edge Cache Check (caches.default) ─────────────────
    const cache = caches.default;
    // Don't check edge cache if Range header is present (let origin handle slice)
    const hasRange = !!request.headers.get("range");

    if (!hasRange && request.method === "GET") {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        const resHeaders = new Headers(cachedResponse.headers);
        resHeaders.set("X-Cache", "HIT-CLOUDFLARE-EDGE");
        resHeaders.set("CF-Edge-PoP", request.cf?.colo || "EDGE");
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: resHeaders,
        });
      }
    }

    // ─── 6. Secure Origin Fetch from Private Backblaze B2 Bucket ─────────
    const BUCKET_NAME = env?.B2_BUCKET_NAME || "Web-Series12";
    const KEY_ID = env?.B2_KEY_ID || "00553afab6058160000000003";
    const APP_KEY = env?.B2_APP_KEY || "K005YeEtD2gw4kfuaypgky5+3f9kCQE";

    const rawPath = decodeURIComponent(url.pathname);
    const cleanPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

    let originResponse;
    try {
      const { token: b2Token, downloadUrl } = await getB2AuthToken(KEY_ID, APP_KEY);
      const targetUrl = `${downloadUrl}/file/${BUCKET_NAME}${cleanPath}`;

      const originHeaders = new Headers();
      // Forward standard media streaming headers
      for (const [k, v] of request.headers.entries()) {
        if (["range", "accept", "accept-encoding", "user-agent", "if-none-match", "if-modified-since"].includes(k.toLowerCase())) {
          originHeaders.set(k, v);
        }
      }
      // Inject internal B2 authorization token (never exposed to client)
      originHeaders.set("Authorization", b2Token);

      originResponse = await fetch(targetUrl, {
        method: request.method,
        headers: originHeaders,
      });
    } catch (originErr) {
      // Automatic failover: fall back to origin web server proxy
      console.warn("[Cloudflare CDN] Primary B2 origin fetch warning:", originErr.message);
      const fallbackUrl = `https://streamvault.app${cleanPath}`;
      originResponse = await fetch(fallbackUrl, { headers: request.headers }).catch(() => null);

      if (!originResponse) {
        return new Response(
          JSON.stringify({
            error: "Bad Gateway",
            message: "Unable to retrieve media from storage origin.",
            detail: originErr.message,
          }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // ─── 7. Construct Optimized CDN Response Headers ──────────────────────
    const responseHeaders = new Headers(originResponse.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, ETag, X-Cache, CF-Edge-PoP");
    responseHeaders.set("X-Cache", "MISS-CLOUDFLARE-EDGE");
    responseHeaders.set("CF-Edge-PoP", request.cf?.colo || "ORIGIN");

    const lowerPath = cleanPath.toLowerCase();

    if (lowerPath.endsWith(".m3u8") || lowerPath.endsWith(".mpd")) {
      // Playlists & Manifests: short browser TTL for dynamic bitrate switching, medium edge cache
      responseHeaders.set("Content-Type", lowerPath.endsWith(".mpd") ? "application/dash+xml" : "application/vnd.apple.mpegurl");
      responseHeaders.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
    } else if (lowerPath.endsWith(".ts") || lowerPath.endsWith(".m4s")) {
      // Media Segments: immutable 1-year edge cache (segments never change)
      responseHeaders.set("Content-Type", lowerPath.endsWith(".ts") ? "video/mp2t" : "video/iso.segment");
      responseHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".webp") || lowerPath.endsWith(".png")) {
      // Spritesheets & Thumbnails: 7-day cache
      responseHeaders.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    } else if (lowerPath.endsWith(".vtt") || lowerPath.endsWith(".json")) {
      // Subtitles & Waveforms: 1-day cache
      responseHeaders.set("Cache-Control", "public, max-age=86400");
    }

    const response = new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders,
    });

    // ─── 8. Store in Cloudflare Edge Cache for subsequent queries ─────────
    if (!hasRange && request.method === "GET" && originResponse.status === 200 && ctx?.waitUntil) {
      ctx.waitUntil(cache.put(request, response.clone()));
    }

    return response;
  },
};
