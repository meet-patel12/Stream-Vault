export type SubscriptionPlanTier = "free" | "basic" | "standard" | "premium" | "family";
export type BillingCycle = "monthly" | "quarterly" | "annual";
export type SupportedCurrency = "USD" | "INR" | "EUR" | "GBP";
export type PaymentGatewayType = "stripe" | "razorpay" | "paypal" | "apple_pay" | "google_pay";

export interface PlanConfig {
  id: SubscriptionPlanTier;
  name: string;
  description: string;
  features: string[];
  maxScreens: number;
  maxQuality: "480p" | "720p" | "1080p" | "4k";
  hasDownloads: boolean;
  hasSpatialAudio: boolean;
  prices: Record<SupportedCurrency, number>; // Monthly base price
}

export const PLAN_CONFIGS: Record<SubscriptionPlanTier, PlanConfig> = {
  free: {
    id: "free",
    name: "Free Ad-Supported",
    description: "Sample our catalog with limited streaming quality",
    features: ["480p Standard Definition", "Watch on 1 supported device", "Limited catalog selection", "Ad-supported"],
    maxScreens: 1,
    maxQuality: "480p",
    hasDownloads: false,
    hasSpatialAudio: false,
    prices: { USD: 0, INR: 0, EUR: 0, GBP: 0 },
  },
  basic: {
    id: "basic",
    name: "Basic",
    description: "Good video quality in HD for solo entertainment",
    features: ["720p High Definition (HD)", "Watch on 1 phone, tablet, or TV", "Ad-free uninterrupted viewing", "Standard audio"],
    maxScreens: 1,
    maxQuality: "720p",
    hasDownloads: true,
    hasSpatialAudio: false,
    prices: { USD: 8.99, INR: 199, EUR: 7.99, GBP: 6.99 },
  },
  standard: {
    id: "standard",
    name: "Standard",
    description: "Great video quality in Full HD for small families",
    features: ["1080p Full High Definition", "Watch on 2 supported devices simultaneously", "Download on 2 devices", "5.1 Surround Sound"],
    maxScreens: 2,
    maxQuality: "1080p",
    hasDownloads: true,
    hasSpatialAudio: false,
    prices: { USD: 13.99, INR: 499, EUR: 12.99, GBP: 10.99 },
  },
  premium: {
    id: "premium",
    name: "Premium",
    description: "Our best video & spatial audio quality in 4K HDR",
    features: ["4K Ultra HD + Dolby Vision & HDR10", "Watch on 4 supported devices simultaneously", "Dolby Atmos Spatial Audio", "Download on 6 devices", "VIP Early Screening access"],
    maxScreens: 4,
    maxQuality: "4k",
    hasDownloads: true,
    hasSpatialAudio: true,
    prices: { USD: 19.99, INR: 649, EUR: 17.99, GBP: 15.99 },
  },
  family: {
    id: "family",
    name: "Family All-Inclusive",
    description: "Complete house coverage with multi-screen simultaneous streaming",
    features: ["4K Ultra HD + HDR on all screens", "Watch on 6 supported devices simultaneously", "Individual parental controls & PINs", "Spatial Audio", "Unlimited offline downloads"],
    maxScreens: 6,
    maxQuality: "4k",
    hasDownloads: true,
    hasSpatialAudio: true,
    prices: { USD: 24.99, INR: 799, EUR: 22.99, GBP: 19.99 },
  },
};

export const BILLING_CYCLE_MULTIPLIERS: Record<BillingCycle, { months: number; discountPercent: number }> = {
  monthly: { months: 1, discountPercent: 0 },
  quarterly: { months: 3, discountPercent: 10 },
  annual: { months: 12, discountPercent: 20 },
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
};

export interface CheckoutSessionRequest {
  plan: SubscriptionPlanTier;
  billingCycle: BillingCycle;
  currency: SupportedCurrency;
  gateway: PaymentGatewayType;
  couponCode?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  gateway: PaymentGatewayType;
  redirectUrl?: string;
  clientSecret?: string; // Stripe or PayPal client secret
  orderId?: string; // Razorpay order_id
  amount: number;
  currency: SupportedCurrency;
  taxAmount: number;
  plan: SubscriptionPlanTier;
  billingCycle: BillingCycle;
}
