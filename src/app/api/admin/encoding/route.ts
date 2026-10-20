import { NextRequest } from "next/server";
import { db } from "@/db";
import { encodingJobs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { processEncodingJob } from "@/lib/encoding-worker";
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalErrorResponse,
  errorResponse,
} from "@/lib/api-response";

export async function GET() {
  try {
    await requireAdmin();

    const jobs = await db
      .select()
      .from(encodingJobs)
      .orderBy(desc(encodingJobs.createdAt));

    return successResponse({ jobs });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("Admin encoding fetch error:", err);
    return internalErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { action, jobId, sourceFile, contentId } = body;

    if (action === "retry" && jobId) {
      const updated = await db
        .update(encodingJobs)
        .set({
          status: "pending",
          progress: 0,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(encodingJobs.id, jobId))
        .returning();

      if (updated.length > 0) {
        const targetId = Number(jobId);
        setImmediate(() => {
          processEncodingJob(targetId).catch((err) => {
            console.error(`[Admin Retry Error] Job ${targetId}:`, err);
          });
        });
      }

      return successResponse({ job: updated[0] });
    }

    if (action === "create" && sourceFile) {
      const newJob = await db
        .insert(encodingJobs)
        .values({
          sourceFile,
          contentId: contentId ? Number(contentId) : null,
          status: "pending",
          progress: 0,
        })
        .returning();

      if (newJob.length > 0) {
        const targetId = newJob[0].id;
        setImmediate(() => {
          processEncodingJob(targetId).catch((err) => {
            console.error(`[Admin Create Error] Job ${targetId}:`, err);
          });
        });
      }

      return successResponse({ job: newJob[0] });
    }

    return errorResponse("Action must be 'retry' or 'create'", 400, "INVALID_ACTION");
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("Admin encoding action error:", err);
    return internalErrorResponse();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId") || searchParams.get("id");
    const clearAll = searchParams.get("all") === "true";

    if (clearAll) {
      await db.delete(encodingJobs);
      return successResponse({ message: "All encoding jobs cleared." });
    }

    if (!jobId) {
      return errorResponse("jobId parameter is required", 400, "MISSING_JOB_ID");
    }

    const deleted = await db
      .delete(encodingJobs)
      .where(eq(encodingJobs.id, Number(jobId)))
      .returning();

    if (deleted.length === 0) {
      return errorResponse("Job not found", 404, "JOB_NOT_FOUND");
    }

    return successResponse({ message: `Job #${jobId} deleted`, job: deleted[0] });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === "UNAUTHORIZED") return unauthorizedResponse();
    if (errorMsg === "FORBIDDEN") return forbiddenResponse("Admin access required.");
    console.error("Admin encoding delete error:", err);
    return internalErrorResponse();
  }
}
