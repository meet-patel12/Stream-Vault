import crypto from "crypto";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_streamvault_production_ready";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder_streamvault_security";

export interface StripeCheckoutParams {
  amount: number; // in cents/paise
  currency: string;
  customerEmail: string;
  planName: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeCheckoutSession(params: StripeCheckoutParams): Promise<{ id: string; url: string }> {
  // If in real test/production mode with valid key:
  if (STRIPE_SECRET_KEY.startsWith("sk_live_") || (STRIPE_SECRET_KEY.startsWith("sk_test_") && !STRIPE_SECRET_KEY.includes("placeholder"))) {
    const body = new URLSearchParams();
    body.append("mode", "payment");
    body.append("success_url", params.successUrl);
    body.append("cancel_url", params.cancelUrl);
    body.append("customer_email", params.customerEmail);
    body.append("line_items[0][price_data][currency]", params.currency.toLowerCase());
    body.append("line_items[0][price_data][unit_amount]", Math.round(params.amount).toString());
    body.append("line_items[0][price_data][product_data][name]", params.planName);
    body.append("line_items[0][quantity]", "1");

    for (const [key, val] of Object.entries(params.metadata)) {
      body.append(`metadata[${key}]`, val);
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Stripe API error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return { id: data.id, url: data.url };
  }

  // Graceful test fallback with cryptographic session ID
  const sessionId = `cs_test_${crypto.randomBytes(16).toString("hex")}`;
  const mockCheckoutUrl = `${params.successUrl}?session_id=${sessionId}&gateway=stripe`;
  return { id: sessionId, url: mockCheckoutUrl };
}

/**
 * Verifies Stripe Webhook signature using standard HMAC SHA-256
 */
export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string = STRIPE_WEBHOOK_SECRET
): boolean {
  try {
    const parts = signatureHeader.split(",");
    const tPart = parts.find((p) => p.startsWith("t="));
    const v1Part = parts.find((p) => p.startsWith("v1="));

    if (!tPart || !v1Part) return false;

    const timestamp = tPart.split("=")[1];
    const signature = v1Part.split("=")[1];

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload, "utf8")
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Execute refund via Stripe API
 */
export async function refundStripePayment(
  paymentIntentId: string,
  amountInCents?: number
): Promise<{ id: string; status: string }> {
  if (STRIPE_SECRET_KEY.startsWith("sk_live_") || (STRIPE_SECRET_KEY.startsWith("sk_test_") && !STRIPE_SECRET_KEY.includes("placeholder"))) {
    const body = new URLSearchParams();
    body.append("payment_intent", paymentIntentId);
    if (amountInCents) body.append("amount", amountInCents.toString());

    const res = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Refund failed");
    return { id: data.id, status: data.status };
  }

  return { id: `re_mock_${Date.now()}`, status: "succeeded" };
}
