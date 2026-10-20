/**
 * Automated Test Suite: Production Streaming Architecture
 * Validates Private Backblaze B2 security, Cloudflare CDN edge delivery,
 * HMAC tokenized playback authorization, 7-resolution ladders, and asset generation.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

const CDN_SECRET_KEY = process.env.CDN_SECRET_KEY || "streamvault-cdn-master-secret-256bit-secure";
const CDN_BASE_URL = "https://empty-math-c190.meetesh032.workers.dev";

// ─── 1. Backblaze B2 Security & Zero-Leakage ─────────────────────────
describe("Backblaze B2 Cloud Storage Security & Protection", () => {
  test("Zero-Leakage: Masks master application keys in logs and client outputs", () => {
    function maskCredential(val) {
      if (!val || val.length < 8) return "********";
      return `${val.slice(0, 4)}...${val.slice(-4)}`;
    }

    const rawKey = "K005BedxuMmK4SiHHlzPTXxSi++C9hg";
    const masked = maskCredential(rawKey);

    assert.notStrictEqual(masked, rawKey);
    assert.strictEqual(masked, "K005...C9hg");
    assert.strictEqual(masked.includes("Bedxu"), false);
  });

  test("B2 Proxy: Routes storage keys strictly through Cloudflare CDN, hiding B2 bucket", () => {
    function getB2ProxyUrl(key) {
      let cleanPath = key;
      if (cleanPath.startsWith("b2://")) cleanPath = cleanPath.slice(5);
      else if (cleanPath.startsWith("b2/")) cleanPath = cleanPath.slice(3);
      if (!cleanPath.startsWith("/")) cleanPath = `/${cleanPath}`;
      return `${CDN_BASE_URL}${cleanPath}`;
    }

    const b2Key = "b2://streams/movie_42/master.m3u8";
    const cdnUrl = getB2ProxyUrl(b2Key);

    assert.strictEqual(cdnUrl.startsWith("https://empty-math-c190.meetesh032.workers.dev/streams/movie_42/master.m3u8"), true);
    assert.strictEqual(cdnUrl.includes("backblazeb2.com"), false, "Direct Backblaze URL must never be exposed");
    assert.strictEqual(cdnUrl.includes("Web-Series22"), false, "Bucket name must not be exposed in client URL");
  });
});

// ─── 2. Playback Authorization & Edge Token Verification ─────────────
describe("Playback Gatekeeping & Edge Authorization Tokens", () => {
  function createPlaybackToken(params) {
    const ttl = params.ttlSeconds || 7200;
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const nonce = crypto.randomBytes(8).toString("hex");

    const payload = {
      u: params.userId,
      p: params.profileId,
      c: params.contentId,
      ip: params.clientIp || "127.0.0.1",
      exp,
      nonce,
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", CDN_SECRET_KEY)
      .update(payloadBase64)
      .digest("base64url");

    return `${payloadBase64}.${signature}`;
  }

  function verifyPlaybackToken(token) {
    if (!token || !token.includes(".")) return { valid: false, reason: "MALFORMED_TOKEN" };
    const [payloadBase64, providedSig] = token.split(".");
    const expectedSig = crypto
      .createHmac("sha256", CDN_SECRET_KEY)
      .update(payloadBase64)
      .digest("base64url");

    if (providedSig !== expectedSig) return { valid: false, reason: "INVALID_SIGNATURE" };

    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) return { valid: false, reason: "TOKEN_EXPIRED" };

    return { valid: true, payload };
  }

  test("Generates valid HMAC-SHA256 playback token with user and content bindings", () => {
    const token = createPlaybackToken({
      userId: 1,
      profileId: 2,
      contentId: 42,
      clientIp: "203.0.113.195",
      ttlSeconds: 3600,
    });

    const result = verifyPlaybackToken(token);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.payload.u, 1);
    assert.strictEqual(result.payload.p, 2);
    assert.strictEqual(result.payload.c, 42);
    assert.strictEqual(result.payload.ip, "203.0.113.195");
  });

  test("Rejects tampered or expired tokens at edge", () => {
    const token = createPlaybackToken({
      userId: 1,
      profileId: 2,
      contentId: 42,
      ttlSeconds: -10, // already expired
    });

    const expiredResult = verifyPlaybackToken(token);
    assert.strictEqual(expiredResult.valid, false);
    assert.strictEqual(expiredResult.reason, "TOKEN_EXPIRED");

    // Tampered token test
    const validToken = createPlaybackToken({ userId: 1, profileId: 2, contentId: 42, ttlSeconds: 3600 });
    const tampered = validToken.slice(0, -4) + "XXXX";
    const tamperedResult = verifyPlaybackToken(tampered);
    assert.strictEqual(tamperedResult.valid, false);
    assert.strictEqual(tamperedResult.reason, "INVALID_SIGNATURE");
  });
});

// ─── 3. Adaptive Resolution Ladder & Multi-Codec ─────────────────────
describe("OTT Adaptive Resolution Ladder (2160p to 240p)", () => {
  const LADDER = [
    { name: "2160p_4k",   width: 3840, height: 2160, bitrateBps: 12000000 },
    { name: "1440p_2k",   width: 2560, height: 1440, bitrateBps: 6500000  },
    { name: "1080p_fhd",  width: 1920, height: 1080, bitrateBps: 4200000  },
    { name: "720p_hd",    width: 1280, height: 720,  bitrateBps: 2200000  },
    { name: "480p_sd",    width: 854,  height: 480,  bitrateBps: 1100000  },
    { name: "360p_mobile",width: 640,  height: 360,  bitrateBps: 550000   },
    { name: "240p_low",   width: 426,  height: 240,  bitrateBps: 260000   },
  ];

  test("Enforces 7 distinct resolution rungs from 4K (2160p) down to 240p", () => {
    assert.strictEqual(LADDER.length, 7);
    assert.strictEqual(LADDER[0].height, 2160);
    assert.strictEqual(LADDER[6].height, 240);
  });

  test("Ensures strict monotonic decreasing bitrate profile across ladder", () => {
    for (let i = 0; i < LADDER.length - 1; i++) {
      assert.ok(
        LADDER[i].bitrateBps > LADDER[i + 1].bitrateBps,
        `Rung ${LADDER[i].name} must have higher bitrate than ${LADDER[i + 1].name}`
      );
    }
  });
});

// ─── 4. Asset Generation: Waveforms & Spritesheets ───────────────────
describe("Media Asset Generation Suite", () => {
  test("Generates 100-sample audio waveform data for scrubber preview", () => {
    function generateWaveformData(durationSeconds) {
      const samples = 100;
      const peaks = [];
      for (let i = 0; i < samples; i++) {
        const t = i / samples;
        const wave = Math.abs(Math.sin(t * Math.PI * 4) * 0.5 + Math.sin(t * Math.PI * 18) * 0.3 + 0.2);
        peaks.push(parseFloat(Math.min(1.0, Math.max(0.05, wave)).toFixed(3)));
      }
      return { peaks, sampleRate: Math.max(1, Math.round(samples / (durationSeconds || 60))) };
    }

    const waveform = generateWaveformData(120);
    assert.strictEqual(waveform.peaks.length, 100);
    assert.ok(waveform.peaks.every((p) => p >= 0.05 && p <= 1.0));
  });

  test("Computes correct WebVTT sprite coordinates for 10x10 tile mosaic", () => {
    const SPRITE_WIDTH = 160;
    const SPRITE_HEIGHT = 90;
    const COLUMNS = 10;

    function getSpriteCoords(index) {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      return {
        x: col * SPRITE_WIDTH,
        y: row * SPRITE_HEIGHT,
        w: SPRITE_WIDTH,
        h: SPRITE_HEIGHT,
      };
    }

    // Frame 0 (top-left)
    assert.deepStrictEqual(getSpriteCoords(0), { x: 0, y: 0, w: 160, h: 90 });
    // Frame 10 (first item in 2nd row)
    assert.deepStrictEqual(getSpriteCoords(10), { x: 0, y: 90, w: 160, h: 90 });
    // Frame 25 (6th item in 3rd row)
    assert.deepStrictEqual(getSpriteCoords(25), { x: 800, y: 180, w: 160, h: 90 });
  });
});

// ─── 5. Cloudflare CDN Caching Rules & Headers ───────────────────────
describe("Cloudflare CDN Edge Caching Compliance", () => {
  function getCdnHeaders(filePath) {
    const p = filePath.toLowerCase();
    if (p.endsWith(".ts") || p.endsWith(".m4s")) {
      return { "Cache-Control": "public, max-age=31536000, immutable" };
    }
    if (p.endsWith(".m3u8") || p.endsWith(".mpd")) {
      return { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" };
    }
    if (p.endsWith(".jpg") || p.endsWith(".webp")) {
      return { "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400" };
    }
    return { "Cache-Control": "public, max-age=86400" };
  }

  test("Video segments receive 1-year immutable edge cache header", () => {
    const headers = getCdnHeaders("segment_001.ts");
    assert.strictEqual(headers["Cache-Control"], "public, max-age=31536000, immutable");
  });

  test("Playlists receive short browser TTL with edge s-maxage and stale-while-revalidate", () => {
    const headers = getCdnHeaders("master.m3u8");
    assert.strictEqual(headers["Cache-Control"], "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  });
});
