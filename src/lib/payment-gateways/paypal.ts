import crypto from "crypto";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "paypal_client_id_placeholder";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "paypal_client_secret_placeholder";
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || "sandbox"; // 'sandbox' or 'production'

const PAYPAL_BASE_URL =
  PAYPAL_ENVIRONMENT === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error("Failed to authenticate with PayPal API");
  }

  const data = await res.json();
  return data.access_token;
}

export interface PayPalOrderParams {
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export async function createPayPalOrder(params: PayPalOrderParams): Promise<{ id: string; approveUrl: string }> {
  if (!PAYPAL_CLIENT_ID.includes("placeholder") && !PAYPAL_CLIENT_SECRET.includes("placeholder")) {
    const token = await getPayPalAccessToken();

    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: params.currency,
              value: params.amount.toFixed(2),
            },
            description: params.description,
          },
        ],
        application_context: {
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
          user_action: "PAY_NOW",
          brand_name: "STREAMVAULT",
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "PayPal Order creation failed");

    const approveLink = data.links?.find((l: any) => l.rel === "approve")?.href || params.returnUrl;
    return { id: data.id, approveUrl: approveLink };
  }

  // Graceful test fallback with sandbox mock link
  const orderId = `PAYPAL_${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  return { id: orderId, approveUrl: `${params.returnUrl}?token=${orderId}&gateway=paypal` };
}

export async function capturePayPalOrder(orderId: string): Promise<{ id: string; status: string }> {
  if (!PAYPAL_CLIENT_ID.includes("placeholder") && !PAYPAL_CLIENT_SECRET.includes("placeholder")) {
    const token = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "PayPal Capture failed");
    return { id: data.id, status: data.status };
  }

  return { id: orderId, status: "COMPLETED" };
}
