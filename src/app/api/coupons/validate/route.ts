import { NextRequest } from "next/server";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  successResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return validationErrorResponse("Coupon code is required.");
    }

    const cleanCode = code.toUpperCase().trim();

    const [coupon] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, cleanCode), eq(coupons.isActive, true)))
      .limit(1);

    if (!coupon) {
      return validationErrorResponse("Invalid or expired coupon code.");
    }

    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
      return validationErrorResponse("This coupon code has expired.");
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return validationErrorResponse("This coupon has reached its maximum usage limit.");
    }

    return successResponse({
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent || 0,
      discountAmount: coupon.discountAmount || 0,
      currency: coupon.currency,
    });
  } catch (err) {
    console.error("Coupon validation error:", err);
    return internalErrorResponse();
  }
}
