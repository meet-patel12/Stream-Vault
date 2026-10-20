import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature, activateSubscription } from "@/lib/payment-gateways";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
    }

    const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
    if (!isValid && process.env.NODE_ENV === "production" && !process.env.RAZORPAY_WEBHOOK_SECRET?.includes("placeholder")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === "order.paid" || event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const notes = payment.notes || {};
      const userId = parseInt(notes.userId, 10);
      const plan = notes.plan;
      const billingCycle = notes.billingCycle;

      if (userId && plan && billingCycle) {
        const totalAmount = payment.amount ? payment.amount / 100 : 0;
        const taxAmount = (totalAmount * 18) / 118;

        await activateSubscription({
          userId,
          plan,
          billingCycle,
          currency: (payment.currency || "INR").toUpperCase(),
          pricePaid: totalAmount,
          taxAmount,
          gateway: "razorpay",
          transactionId: payment.id,
        });
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Razorpay Webhook Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
