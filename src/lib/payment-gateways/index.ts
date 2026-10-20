import { db } from "@/db";
import { subscriptions, invoices, paymentTransactions, users, coupons } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  PLAN_CONFIGS,
  BILLING_CYCLE_MULTIPLIERS,
  SubscriptionPlanTier,
  BillingCycle,
  SupportedCurrency,
  PaymentGatewayType,
  CheckoutSessionRequest,
  CheckoutSessionResult,
} from "./types";
import { createStripeCheckoutSession } from "./stripe";
import { createRazorpayOrder } from "./razorpay";
import { createPayPalOrder } from "./paypal";
import crypto from "crypto";

export * from "./types";
export * from "./stripe";
export * from "./razorpay";
export * from "./paypal";
export * from "./wallets";

export interface PriceCalculation {
  baseMonthlyPrice: number;
  months: number;
  grossAmount: number;
  billingDiscountAmount: number;
  couponDiscountAmount: number;
  netTaxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  currency: SupportedCurrency;
}

/**
 * Calculates pricing with GST and discounts
 */
export async function calculateSubscriptionPrice(
  planTier: SubscriptionPlanTier,
  cycle: BillingCycle,
  currency: SupportedCurrency,
  couponCode?: string
): Promise<PriceCalculation> {
  const plan = PLAN_CONFIGS[planTier];
  if (!plan) throw new Error("Invalid plan tier");

  const basePrice = plan.prices[currency] || plan.prices.USD;
  const cycleInfo = BILLING_CYCLE_MULTIPLIERS[cycle];
  const months = cycleInfo.months;
  const gross = basePrice * months;

  // Billing cycle discount (e.g. 10% or 20%)
  const billingDiscount = (gross * cycleInfo.discountPercent) / 100;
  let discounted = gross - billingDiscount;

  // Coupon discount if valid
  let couponDiscount = 0;
  if (couponCode) {
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.code, couponCode.toUpperCase().trim()),
          eq(coupons.isActive, true)
        )
      )
      .limit(1);

    if (coupon) {
      const isNotExpired = !coupon.validUntil || new Date(coupon.validUntil) > new Date();
      const hasUsesLeft = (coupon.maxUses || 1000) > coupon.usedCount;
      if (isNotExpired && hasUsesLeft) {
        if (coupon.discountPercent && coupon.discountPercent > 0) {
          couponDiscount = (discounted * coupon.discountPercent) / 100;
        } else if (coupon.discountAmount && coupon.discountAmount > 0) {
          couponDiscount = Math.min(coupon.discountAmount, discounted);
        }
      }
    }
  }

  const netTaxable = Math.max(discounted - couponDiscount, 0);
  const gstRate = 18.0; // 18% standard GST
  const gstAmount = netTaxable > 0 ? (netTaxable * gstRate) / 100 : 0;
  const totalAmount = netTaxable + gstAmount;

  return {
    baseMonthlyPrice: basePrice,
    months,
    grossAmount: Number(gross.toFixed(2)),
    billingDiscountAmount: Number(billingDiscount.toFixed(2)),
    couponDiscountAmount: Number(couponDiscount.toFixed(2)),
    netTaxableAmount: Number(netTaxable.toFixed(2)),
    gstRate,
    gstAmount: Number(gstAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    currency,
  };
}

/**
 * Orchestrates checkout session creation
 */
export async function createCheckoutSession(
  userId: number,
  userEmail: string,
  req: CheckoutSessionRequest,
  originUrl: string
): Promise<CheckoutSessionResult> {
  const price = await calculateSubscriptionPrice(
    req.plan,
    req.billingCycle,
    req.currency,
    req.couponCode
  );

  const planName = `${PLAN_CONFIGS[req.plan].name} (${req.billingCycle.toUpperCase()})`;
  const successUrl = req.returnUrl || `${originUrl}/account?session_status=success`;
  const cancelUrl = req.cancelUrl || `${originUrl}/account?session_status=cancelled`;

  // Free Tier direct activation
  if (req.plan === "free" || price.totalAmount === 0) {
    const sessionId = `free_sub_${crypto.randomBytes(8).toString("hex")}`;
    await activateSubscription({
      userId,
      plan: req.plan,
      billingCycle: req.billingCycle,
      currency: req.currency,
      pricePaid: 0,
      taxAmount: 0,
      gateway: req.gateway,
      transactionId: sessionId,
    });

    return {
      sessionId,
      gateway: req.gateway,
      redirectUrl: `${successUrl}&session_id=${sessionId}`,
      amount: 0,
      currency: req.currency,
      taxAmount: 0,
      plan: req.plan,
      billingCycle: req.billingCycle,
    };
  }

  if (req.gateway === "stripe") {
    // Stripe expects cents or paise
    const multiplier = req.currency === "INR" ? 100 : 100;
    const session = await createStripeCheckoutSession({
      amount: Math.round(price.totalAmount * multiplier),
      currency: req.currency,
      customerEmail: userEmail,
      planName,
      metadata: {
        userId: userId.toString(),
        plan: req.plan,
        billingCycle: req.billingCycle,
        couponCode: req.couponCode || "",
      },
      successUrl,
      cancelUrl,
    });

    return {
      sessionId: session.id,
      gateway: "stripe",
      redirectUrl: session.url,
      amount: price.totalAmount,
      currency: req.currency,
      taxAmount: price.gstAmount,
      plan: req.plan,
      billingCycle: req.billingCycle,
    };
  }

  if (req.gateway === "razorpay") {
    const order = await createRazorpayOrder({
      amount: Math.round(price.totalAmount * 100),
      currency: req.currency === "INR" ? "INR" : "USD",
      receipt: `rcpt_${userId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        plan: req.plan,
        billingCycle: req.billingCycle,
      },
    });

    return {
      sessionId: order.id,
      orderId: order.id,
      gateway: "razorpay",
      redirectUrl: `${successUrl}&order_id=${order.id}&gateway=razorpay`,
      amount: price.totalAmount,
      currency: req.currency,
      taxAmount: price.gstAmount,
      plan: req.plan,
      billingCycle: req.billingCycle,
    };
  }

  if (req.gateway === "paypal") {
    const order = await createPayPalOrder({
      amount: price.totalAmount,
      currency: req.currency,
      description: planName,
      returnUrl: successUrl,
      cancelUrl,
    });

    return {
      sessionId: order.id,
      gateway: "paypal",
      redirectUrl: order.approveUrl,
      amount: price.totalAmount,
      currency: req.currency,
      taxAmount: price.gstAmount,
      plan: req.plan,
      billingCycle: req.billingCycle,
    };
  }

  // Digital Wallets: Apple Pay / Google Pay direct session
  const walletSessionId = `wallet_${crypto.randomBytes(12).toString("hex")}`;
  return {
    sessionId: walletSessionId,
    gateway: req.gateway,
    redirectUrl: `${successUrl}&session_id=${walletSessionId}&gateway=${req.gateway}`,
    amount: price.totalAmount,
    currency: req.currency,
    taxAmount: price.gstAmount,
    plan: req.plan,
    billingCycle: req.billingCycle,
  };
}

/**
 * Activates or renews user subscription, creates invoice and updates users table
 */
export async function activateSubscription(params: {
  userId: number;
  plan: SubscriptionPlanTier;
  billingCycle: BillingCycle;
  currency: SupportedCurrency;
  pricePaid: number;
  taxAmount: number;
  gateway: PaymentGatewayType;
  transactionId: string;
  gatewaySubscriptionId?: string;
  gatewayCustomerId?: string;
}) {
  const months = BILLING_CYCLE_MULTIPLIERS[params.billingCycle].months;
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + months * 30);

  // Check if user already has an active subscription
  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, params.userId))
    .limit(1);

  let subId: number;

  if (existingSub) {
    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: params.plan,
        billingCycle: params.billingCycle,
        status: "active",
        currency: params.currency,
        pricePaid: params.pricePaid,
        taxAmount: params.taxAmount,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        pausedAt: null,
        canceledAt: null,
        gateway: params.gateway,
        gatewaySubscriptionId: params.gatewaySubscriptionId || existingSub.gatewaySubscriptionId,
        gatewayCustomerId: params.gatewayCustomerId || existingSub.gatewayCustomerId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existingSub.id))
      .returning();
    subId = updated.id;
  } else {
    const [created] = await db
      .insert(subscriptions)
      .values({
        userId: params.userId,
        plan: params.plan,
        billingCycle: params.billingCycle,
        status: "active",
        currency: params.currency,
        pricePaid: params.pricePaid,
        taxAmount: params.taxAmount,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        gateway: params.gateway,
        gatewaySubscriptionId: params.gatewaySubscriptionId,
        gatewayCustomerId: params.gatewayCustomerId,
      })
      .returning();
    subId = created.id;
  }

  // Update users table plan
  const mappedUserPlan =
    params.plan === "family" || params.plan === "premium"
      ? "premium"
      : params.plan === "standard"
      ? "standard"
      : "basic";

  await db
    .update(users)
    .set({
      plan: mappedUserPlan,
      updatedAt: new Date(),
    })
    .where(eq(users.id, params.userId));

  // Generate unique GST Invoice
  const invoiceNum = `INV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  await db.insert(invoices).values({
    userId: params.userId,
    subscriptionId: subId,
    invoiceNumber: invoiceNum,
    amount: params.pricePaid,
    currency: params.currency,
    gstRate: 18.0,
    gstAmount: params.taxAmount,
    status: "paid",
    paymentMethod: params.gateway.toUpperCase(),
    paymentGateway: params.gateway,
    transactionId: params.transactionId,
    billingAddress: {
      registeredCountry: params.currency === "INR" ? "India" : "United States",
      taxId: params.currency === "INR" ? "GSTIN27AABCS1429B1Z2" : "EIN-98-3482910",
    },
  });

  // Record payment transaction
  await db.insert(paymentTransactions).values({
    userId: params.userId,
    amount: params.pricePaid,
    currency: params.currency,
    status: "succeeded",
    gateway: params.gateway,
    gatewayTransactionId: params.transactionId,
    gatewayPaymentMethod: params.gateway,
    metadata: {
      subscriptionId: subId,
      plan: params.plan,
      billingCycle: params.billingCycle,
    },
  });

  return { subscriptionId: subId, invoiceNumber: invoiceNum };
}
