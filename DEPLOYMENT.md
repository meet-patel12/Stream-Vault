# 🚀 Deployment & Operations Guide (`DEPLOYMENT.md`)
**Role:** Principal DevOps Engineer & Cloud Architect  
**Environments:** Local Docker Compose, Kubernetes Production Cluster, Cloudflare / Neon / AWS / Vercel

---

## 1. Environment Configuration Matrix

Create or populate `.env.local` or Kubernetes Secrets with the following keys. Production defaults with sandbox fallbacks are enabled:

```ini
# ─── Database & Caching ────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require
REDIS_URL=redis://localhost:6379

# ─── JWT & Authentication ─────────────────────────────────────────────────────
JWT_ACCESS_SECRET=your-32-char-jwt-access-secret-minimum-length
JWT_REFRESH_SECRET=your-32-char-jwt-refresh-secret-minimum-length
COOKIE_DOMAIN=localhost

# ─── Payment Gateways (Phase 5) ────────────────────────────────────────────────
# Stripe
STRIPE_SECRET_KEY=sk_test_placeholder_key_for_live_credentials
STRIPE_WEBHOOK_SECRET=whsec_placeholder_webhook_secret

# Razorpay
RAZORPAY_KEY_ID=rzp_test_placeholder_key_id
RAZORPAY_KEY_SECRET=placeholder_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=placeholder_razorpay_webhook_secret

# PayPal
PAYPAL_CLIENT_ID=placeholder_paypal_client_id
PAYPAL_CLIENT_SECRET=placeholder_paypal_client_secret
PAYPAL_MODE=sandbox # or 'live'

# Apple Pay & Google Pay (Digital Wallets)
APPLE_PAY_MERCHANT_ID=merchant.com.streamvault.streaming
GOOGLE_PAY_MERCHANT_ID=12345678901234567890

# ─── Video Streaming & CDN ────────────────────────────────────────────────────
CDN_STREAMING_URL=https://test-streams.mux.dev
CDN_SECRET_KEY=your-cdn-hmac-sha256-signing-secret
B2_APPLICATION_KEY_ID=your-b2-key-id
B2_APPLICATION_KEY=your-b2-app-key
B2_BUCKET_NAME=streamvault-media
```

---

## 2. Docker Compose Deployment

Run the complete multi-container production stack:

```bash
# Build and start all services in detached mode
docker compose up --build -d

# Verify container health
docker compose ps
```

### Port Mappings
- **Web Application:** [http://localhost:3000](http://localhost:3000) (Next.js 16)
- **NGINX Edge Proxy:** [http://localhost](http://localhost) (Port 80/443)
- **FastAPI Media Server:** [http://localhost:8000](http://localhost:8000)
- **PostgreSQL Database:** `localhost:5432`
- **Redis Cache:** `localhost:6379`

---

## 3. Database Migrations

Run all database schema migrations sequentially:
```bash
# Core schema, profiles, and PIN security
node scripts/migrate-profiles.js

# Subscriptions, coupons, invoices, and transactions
node scripts/migrate-subscriptions.js

# Playlists, downloads, notifications, devices, 2FA
node scripts/migrate-phases8-14.js

# High-throughput query performance indexes
node scripts/optimize-indexes.js
```

---

## 4. Test Suite Execution

Run automated unit, integration, and security verification tests:
```bash
# Execute master test harness
npm test

# Type verification
npm run typecheck
```
