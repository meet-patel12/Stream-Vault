import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export interface AuditEventParams {
  userId?: number | null;
  action: string;
  targetType?: "content" | "user" | "job" | "system" | "auth";
  targetId?: string | number | null;
  ipAddress?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Asynchronous, non-blocking Security & Compliance Audit Logger
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId || null,
      action: params.action,
      targetType: params.targetType || "system",
      targetId: params.targetId ? String(params.targetId) : null,
      ipAddress: params.ipAddress || null,
      metadata: params.metadata || {},
    });
  } catch (err) {
    // Audit log failure should be logged to stderr without crashing the client request
    console.error("[Audit Log Error]:", err);
  }
}
