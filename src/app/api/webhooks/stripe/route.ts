import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhookSignature, activateSubscription } from "@/lib/payment-gateways";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    const isValid = verifyStripeWebhookSignature(rawBody, signature);
    // If live signature check fails and not in dev/test placeholder:
    if (!isValid && process.env.NODE_ENV === "production" && !process.env.STRIPE_WEBHOOK_SECRET?.includes("placeholder")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const userId = parseInt(metadata.userId, 10);
        const plan = metadata.plan;
        const billingCycle = metadata.billingCycle;

        if (userId && plan && billingCycle) {
          const totalAmount = session.amount_total ? session.amount_total / 100 : 0;
          const taxAmount = (totalAmount * 18) / 118; // Included GST

          await activateSubscription({
            userId,
            plan,
            billingCycle,
            currency: (session.currency || "USD").toUpperCase(),
            pricePaid: totalAmount,
            taxAmount,
            gateway: "stripe",
            transactionId: session.payment_intent || session.id,
            gatewaySubscriptionId: session.subscription,
            gatewayCustomerId: session.customer,
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Renewal invoice payment
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Stripe Webhook Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
