import Redis from "ioredis";

// Centralized Redis Client for Caching, Distributed Rate Limiting, and Queues
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisClient: Redis | null = null;
let isRedisAvailable = false;

try {
  redisClient = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop retrying after 3 attempts and fall back to memory
      }
      return Math.min(times * 200, 1000);
    },
  });

  redisClient.on("connect", () => {
    isRedisAvailable = true;
    console.log("[Redis] Connected successfully to:", REDIS_URL);
  });

  redisClient.on("error", (err) => {
    isRedisAvailable = false;
    // Suppress spammy connection error logs when Redis is not running locally
    if (process.env.NODE_ENV !== "production") {
      // Keep quiet during development if running standalone without Docker Redis
    }
  });

  // Attempt initial connect asynchronously
  redisClient.connect().catch(() => {
    isRedisAvailable = false;
  });
} catch (e) {
  isRedisAvailable = false;
}

export function getRedisClient(): Redis | null {
  return isRedisAvailable ? redisClient : null;
}

export function isRedisConnected(): boolean {
  return isRedisAvailable && redisClient?.status === "ready";
}

export default redisClient;
