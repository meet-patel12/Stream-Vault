import { NextResponse } from "next/server";
import { db, pool } from "@/db";
import { users, content, encodingJobs, playbackTelemetry } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * GET /api/metrics
 * Standard Prometheus Scraping Endpoint (text/plain; version=0.0.4)
 */
export async function GET() {
  const lines: string[] = [];

  const addMetric = (name: string, help: string, type: "counter" | "gauge", value: number, labels?: Record<string, string>) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
    if (labels && Object.keys(labels).length > 0) {
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(`${name}{${labelStr}} ${value}`);
    } else {
      lines.push(`${name} ${value}`);
    }
  };

  try {
    // 1. Node.js Process Runtime Metrics
    const mem = process.memoryUsage();
    addMetric("nodejs_process_uptime_seconds", "Process uptime in seconds", "gauge", Math.round(process.uptime()));
    addMetric("nodejs_heap_bytes_used", "Node.js heap memory used in bytes", "gauge", mem.heapUsed);
    addMetric("nodejs_heap_bytes_total", "Node.js heap memory total allocated in bytes", "gauge", mem.heapTotal);
    addMetric("nodejs_rss_bytes", "Node.js resident set size in bytes", "gauge", mem.rss);

    // 2. Database Connection Pool Metrics
    addMetric("streamvault_db_pool_total_connections", "Total PostgreSQL pool connections", "gauge", pool.totalCount);
    addMetric("streamvault_db_pool_idle_connections", "Idle PostgreSQL pool connections", "gauge", pool.idleCount);
    addMetric("streamvault_db_pool_waiting_requests", "Requests waiting for a DB connection", "gauge", pool.waitingCount);

    // 3. Platform Entities & Stream Counts
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    addMetric("streamvault_users_total", "Total registered users", "gauge", userCount?.count || 0);

    const [contentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(content);
    addMetric("streamvault_catalog_content_total", "Total published content items", "gauge", contentCount?.count || 0);

    // 4. Encoding Queue Job Breakdown
    const jobStats = await db
      .select({
        status: encodingJobs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(encodingJobs)
      .groupBy(encodingJobs.status);

    lines.push("# HELP streamvault_encoding_jobs_count Current count of encoding jobs by status");
    lines.push("# TYPE streamvault_encoding_jobs_count gauge");
    for (const j of jobStats) {
      lines.push(`streamvault_encoding_jobs_count{status="${j.status}"} ${j.count}`);
    }

    // 5. Playback Telemetry Events
    const [telemetryCount] = await db.select({ count: sql<number>`count(*)::int` }).from(playbackTelemetry);
    addMetric("streamvault_playback_telemetry_events_total", "Total streaming telemetry events ingested", "counter", telemetryCount?.count || 0);

    // 6. Intelligent Cache & Resilience Engine Metrics
    const { getCacheStats } = await import("@/lib/cache");
    const cacheStats = getCacheStats();
    addMetric("streamvault_cache_hit_ratio_percent", "Cache hit ratio percentage", "gauge", cacheStats.hitRatioPercent);
    addMetric("streamvault_cache_hits_total", "Total cache hits", "counter", cacheStats.hits);
    addMetric("streamvault_cache_misses_total", "Total cache misses", "counter", cacheStats.misses);
    addMetric("streamvault_cache_deduped_requests_total", "Single-flight coalesced request count", "counter", cacheStats.dedupedRequests);

    return new Response(lines.join("\n") + "\n", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[Prometheus Metrics Error]:", err);
    return new Response("# Error gathering metrics\n", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
