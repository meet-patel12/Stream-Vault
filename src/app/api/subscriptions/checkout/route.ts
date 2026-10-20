import { NextRequest } from "next/server";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { createCheckoutSession, CheckoutSessionRequest } from "@/lib/payment-gateways";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const userId = parseInt(session.sub, 10);
    const body: CheckoutSessionRequest = await request.json();

    if (!body.plan || !body.billingCycle || !body.gateway) {
      return validationErrorResponse("plan, billingCycle, and gateway are required.");
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";

    const result = await createCheckoutSession(
      userId,
      session.email,
      {
        plan: body.plan,
        billingCycle: body.billingCycle,
        currency: body.currency || "USD",
        gateway: body.gateway,
        couponCode: body.couponCode,
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl,
      },
      origin
    );

    return successResponse(result);
  } catch (err: any) {
    console.error("Checkout creation error:", err);
    return validationErrorResponse(err.message || "Failed to create checkout session");
  }
}
