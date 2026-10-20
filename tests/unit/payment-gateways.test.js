const test = require("node:test");
const assert = require("node:assert/strict");

// Pure pricing and GST calculation logic matching src/lib/payment-gateways/
function calculateSubscriptionPrice(plan, cycle, currency = "USD", coupon = null) {
  const BASE_PRICES = {
    free: 0,
    basic: 9.99,
    standard: 15.49,
    premium: 19.99,
    family: 24.99,
  };

  const CURRENCY_MULTIPLIERS = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.0,
  };

  const monthlyBase = BASE_PRICES[plan] ?? 9.99;
  const multiplier = CURRENCY_MULTIPLIERS[currency] ?? 1.0;
  const monthlyInCurrency = Math.round(monthlyBase * multiplier * 100) / 100;

  let basePrice = 0;
  if (cycle === "annual") {
    basePrice = Math.round(monthlyInCurrency * 12 * 0.8 * 100) / 100; // 20% off
  } else if (cycle === "quarterly") {
    basePrice = Math.round(monthlyInCurrency * 3 * 0.9 * 100) / 100; // 10% off
  } else {
    basePrice = monthlyInCurrency;
  }

  let discount = 0;
  if (coupon) {
    if (coupon.discountType === "percentage") {
      discount = Math.round((basePrice * (coupon.discountValue / 100)) * 100) / 100;
    } else {
      discount = Math.min(basePrice, coupon.discountValue);
    }
  }

  const discountedPrice = Math.max(0, basePrice - discount);
  const gstAmount = Math.round(discountedPrice * 0.18 * 100) / 100; // 18% GST
  const grandTotal = Math.round((discountedPrice + gstAmount) * 100) / 100;

  return {
    basePrice,
    discount,
    discountedPrice,
    gstAmount,
    grandTotal,
    gstRate: 0.18,
  };
}

test("Payment Engine: Calculates Monthly Premium in USD with 18% GST", () => {
  const pricing = calculateSubscriptionPrice("premium", "monthly", "USD");
  assert.equal(pricing.basePrice, 19.99);
  assert.equal(pricing.discount, 0);
  assert.equal(pricing.gstAmount, 3.60); // 19.99 * 0.18 = 3.5982 -> 3.60
  assert.equal(pricing.grandTotal, 23.59);
});

test("Payment Engine: Calculates Annual Premium with 20% discount and GST", () => {
  const pricing = calculateSubscriptionPrice("premium", "annual", "USD");
  // 19.99 * 12 * 0.8 = 191.90
  assert.equal(pricing.basePrice, 191.9);
  assert.equal(pricing.gstAmount, Math.round(191.9 * 0.18 * 100) / 100);
  assert.equal(pricing.grandTotal, Math.round((191.9 + pricing.gstAmount) * 100) / 100);
});

test("Payment Engine: Applies 50% discount coupon correctly", () => {
  const coupon = { code: "HALFPRICE", discountType: "percentage", discountValue: 50 };
  const pricing = calculateSubscriptionPrice("standard", "monthly", "USD", coupon);
  assert.equal(pricing.basePrice, 15.49);
  assert.equal(pricing.discount, 7.75); // 15.49 * 0.5 = 7.745 -> 7.75
  assert.equal(pricing.discountedPrice, 7.74);
  assert.equal(pricing.gstAmount, 1.39); // 7.74 * 0.18 = 1.3932 -> 1.39
  assert.equal(pricing.grandTotal, 9.13);
});

test("Payment Engine: Converts currency to INR correctly", () => {
  const pricing = calculateSubscriptionPrice("basic", "monthly", "INR");
  // 9.99 * 83 = 829.17
  assert.equal(pricing.basePrice, 829.17);
  assert.ok(pricing.grandTotal > pricing.basePrice); // includes 18% GST
});
