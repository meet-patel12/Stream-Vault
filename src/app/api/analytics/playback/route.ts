import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { playbackTelemetry } from "@/db/schema";
import { getSessionOrRefresh } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sql, desc, eq } from "drizzle-orm";
import type { PlaybackTelemetryEvent } from "@/types";

/**
 * POST /api/analytics/playback
 * High-throughput ingestion of client QoE telemetry events
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`telemetry:${ip}`, RATE_LIMITS.telemetry);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { message: "Telemetry rate limit exceeded", code: "RATE_LIMITED" } },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const events: PlaybackTelemetryEvent[] = Array.isArray(body) ? body : [body];
    const userAgent = request.headers.get("user-agent") ?? "Unknown";

    // Validate and prepare records
    const records = events
      .filter((e) => e && e.sessionId && e.contentId && e.eventType)
      .map((e) => ({
        sessionId: e.sessionId,
        profileId: e.profileId || null,
        contentId: e.contentId,
        eventType: e.eventType,
        currentTime: e.currentTime || 0,
        startupLatencyMs: e.startupLatencyMs ?? null,
        bufferDurationMs: e.bufferDurationMs ?? null,
        currentBitrateBps: e.currentBitrateBps ?? null,
        currentResolution: e.currentResolution ?? null,
        droppedFrames: e.droppedFrames ?? 0,
        playerEngine: e.playerEngine ?? "shaka",
        userAgent,
        errorMessage: e.errorMessage ?? null,
      }));

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "No valid telemetry events provided", code: "INVALID_BODY" } },
        { status: 400 }
      );
    }

    // Insert records asynchronously
    await db.insert(playbackTelemetry).values(records);

    return NextResponse.json({
      success: true,
      data: { ingested: records.length },
    });
  } catch (err) {
    console.error("[Telemetry Ingest Error]:", err);
    return NextResponse.json(
      { success: false, error: { message: "Failed to record telemetry", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/playback
 * Aggregated QoE / Streaming Health KPI summary
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contentIdParam = searchParams.get("contentId");

    // Aggregate QoE Metrics
    const baseCondition = contentIdParam
      ? sql`${playbackTelemetry.contentId} = ${parseInt(contentIdParam, 10)}`
      : sql`1=1`;

    const [metrics] = await db
      .select({
        totalEvents: sql<number>`count(*)::int`,
        uniqueSessions: sql<number>`count(distinct ${playbackTelemetry.sessionId})::int`,
        avgStartupMs: sql<number>`round(avg(${playbackTelemetry.startupLatencyMs}))::int`,
        avgBufferMs: sql<number>`round(avg(${playbackTelemetry.bufferDurationMs}))::int`,
        avgBitrateBps: sql<number>`round(avg(${playbackTelemetry.currentBitrateBps}))::int`,
        totalDroppedFrames: sql<number>`sum(${playbackTelemetry.droppedFrames})::int`,
      })
      .from(playbackTelemetry)
      .where(baseCondition);

    // Event type distribution
    const eventBreakdown = await db
      .select({
        eventType: playbackTelemetry.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(playbackTelemetry)
      .where(baseCondition)
      .groupBy(playbackTelemetry.eventType);

    // Resolution distribution
    const resolutionBreakdown = await db
      .select({
        resolution: playbackTelemetry.currentResolution,
        count: sql<number>`count(*)::int`,
      })
      .from(playbackTelemetry)
      .where(sql`${baseCondition} and ${playbackTelemetry.currentResolution} is not null`)
      .groupBy(playbackTelemetry.currentResolution)
      .orderBy(desc(sql`count(*)`))
      .limit(6);

    return NextResponse.json({
      success: true,
      data: {
        summary: metrics,
        events: eventBreakdown,
        resolutions: resolutionBreakdown,
      },
    });
  } catch (err) {
    console.error("[Telemetry Summary Error]:", err);
    return NextResponse.json(
      { success: false, error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
