import { NextRequest } from "next/server";
import { db } from "@/db";
import { subscriptions, invoices, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { PLAN_CONFIGS } from "@/lib/payment-gateways/types";

export async function GET(request: NextRequest) {
  void request;
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);

    // Fetch subscription
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    // Fetch user invoices
    const userInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.createdAt))
      .limit(20);

    const currentPlanKey = (sub?.plan as keyof typeof PLAN_CONFIGS) || "basic";
    const currentPlanConfig = PLAN_CONFIGS[currentPlanKey] || PLAN_CONFIGS.basic;

    return successResponse({
      subscription: sub || {
        plan: "basic",
        billingCycle: "monthly",
        status: "active",
        currency: "USD",
        pricePaid: 8.99,
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
      planConfig: currentPlanConfig,
      allPlans: PLAN_CONFIGS,
      invoices: userInvoices,
    });
  } catch (err) {
    console.error("Get current subscription error:", err);
    return internalErrorResponse();
  }
}
