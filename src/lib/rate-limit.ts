import { NextRequest } from "next/server";
import { getRedisClient } from "./redis";

// Dual-Engine Rate Limiter: In-Memory Sliding Window with Distributed Redis Synchronization
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  totalLimit: number;
  retryAfterSeconds: number;
}

export const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 15 },       // 15 per 15 min (credential protection)
  login: { windowMs: 5 * 60 * 1000, maxRequests: 8 },         // 8 per 5 min (brute force protection)
  api: { windowMs: 60 * 1000, maxRequests: 120 },             // 120 per min
  search: { windowMs: 60 * 1000, maxRequests: 60 },           // 60 per min
  upload: { windowMs: 10 * 60 * 1000, maxRequests: 10 },      // 10 per 10 min
  payment: { windowMs: 5 * 60 * 1000, maxRequests: 12 },      // 12 per 5 min (fraud prevention)
  admin: { windowMs: 60 * 1000, maxRequests: 180 },           // 180 per min
  progress: { windowMs: 10 * 1000, maxRequests: 40 },         // 40 per 10s
  telemetry: { windowMs: 60 * 1000, maxRequests: 180 },       // 180 per min
};

/**
 * Extract robust client identifier from request headers (Cloudflare, Nginx, Proxy aware)
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "127.0.0.1";
}

/**
 * High-performance synchronous rate limiter with memory sliding window
 * and asynchronous Redis distributed state tracking.
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const record = requestCounts.get(key);

  let allowed = true;
  let remaining = config.maxRequests - 1;
  let resetAt = now + config.windowMs;

  if (!record || now > record.resetAt) {
    requestCounts.set(key, { count: 1, resetAt });
    remaining = config.maxRequests - 1;
  } else if (record.count >= config.maxRequests) {
    allowed = false;
    remaining = 0;
    resetAt = record.resetAt;
  } else {
    record.count++;
    remaining = Math.max(0, config.maxRequests - record.count);
    resetAt = record.resetAt;
  }

  const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000));

  // Non-blocking asynchronous sync to Redis if available
  const redis = getRedisClient();
  if (redis) {
    const redisKey = `ratelimit:${key}`;
    redis
      .pipeline()
      .incr(redisKey)
      .pexpire(redisKey, config.windowMs)
      .exec()
      .catch(() => {
        // Fail silently to preserve performance
      });
  }

  return {
    allowed,
    remaining,
    resetAt,
    totalLimit: config.maxRequests,
    retryAfterSeconds,
  };
}

/**
 * Fully distributed asynchronous Redis sliding-window rate limiter
 */
export async function rateLimitDistributed(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (!redis) {
    return rateLimit(key, config);
  }

  const now = Date.now();
  const redisKey = `ratelimit:dist:${key}`;
  const clearBefore = now - config.windowMs;

  try {
    const multi = redis.multi();
    // Remove timestamps older than window
    multi.zremrangebyscore(redisKey, 0, clearBefore);
    // Add current timestamp as unique member
    multi.zadd(redisKey, now, `${now}:${Math.random()}`);
    // Count active items in window
    multi.zcard(redisKey);
    // Refresh TTL
    multi.pexpire(redisKey, config.windowMs);

    const results = await multi.exec();
    const count = (results?.[2]?.[1] as number) || 1;

    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);
    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil(config.windowMs / 1000));

    return {
      allowed,
      remaining,
      resetAt: now + config.windowMs,
      totalLimit: config.maxRequests,
      retryAfterSeconds,
    };
  } catch {
    return rateLimit(key, config);
  }
}

/**
 * Multi-factor rate limit checker with role-based quotas
 */
export function checkRateLimit(
  request: NextRequest,
  tier: keyof typeof RATE_LIMITS = "api",
  options?: { userId?: number; role?: string }
): RateLimitResult {
  const ip = getClientIp(request);
  const baseConfig = RATE_LIMITS[tier] || RATE_LIMITS.api;

  // Elevate quota by 2.5x for admins
  const maxRequests =
    options?.role === "admin"
      ? Math.round(baseConfig.maxRequests * 2.5)
      : baseConfig.maxRequests;

  const key = options?.userId
    ? `user:${options.userId}:${tier}`
    : `ip:${ip}:${tier}`;

  return rateLimit(key, { windowMs: baseConfig.windowMs, maxRequests });
}

/**
 * Convert rate limit result to standard HTTP headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.totalLimit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  return headers;
}
