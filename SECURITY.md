# 🛡️ Security Architecture & Policy Reference (`SECURITY.md`)
**Role:** Principal Security Engineer  
**Classification:** Enterprise Production Standard

---

## 1. Authentication & JWT Rotation

1. **Access Tokens:**
   - Standard: Signed JWT using `jose` library (`HS256` or `RS256`).
   - Expiration: Short-lived (15 minutes).
   - Delivery: Cookie with `HttpOnly`, `SameSite=Lax`, and `Secure` flag enabled in production.
2. **Refresh Tokens:**
   - Standard: High-entropy cryptographically random 64-byte hex string.
   - Storage: Cryptographic SHA-256 hash stored in PostgreSQL (`refresh_tokens` table). Raw token never stored in plain text.
   - Expiration: 30 days.
   - Revocation: Immediate database revocation upon logout or password change (`revoked_at` timestamp).
3. **Password Security:**
   - Standard: `bcrypt` with salt rounds = 12.
   - Constant-time comparison employed to prevent user enumeration via timing discrepancies.

---

## 2. Distributed Rate Limiting

- **Engine:** Redis Sliding Window Rate Limiter with In-Memory fallback (`src/lib/rate-limit.ts`).
- **Policy Tiers:**
  - `auth`: 15 requests per 15 minutes per IP (prevents brute-force credential stuffing).
  - `api`: 120 requests per minute per IP.
  - `search`: 45 requests per minute per IP.
  - `progress`: 30 requests per 10 seconds per IP.
  - `telemetry`: 180 requests per minute per IP.
- **Enforcement:** Emits standard `429 Too Many Requests` status code with `Retry-After` header.

---

## 3. Streaming Content Security & Signed URLs

- **Algorithm:** HMAC SHA-256 token verification (`src/lib/signed-url.ts`).
- **Signature Construction:** `HMAC_SHA256(CDN_SECRET, "${key}:${expires}")`.
- **Constant-Time Verification:** Uses `crypto.timingSafeEqual()` to eliminate side-channel timing attacks.
- **Edge Token Expiry:** All generated playback URLs expire within 3600 seconds (1 hour).

---

## 4. Security Audit Logging

- **Engine:** Non-blocking async event logging in `src/lib/audit.ts`.
- **Monitored Events:**
  - `CONTENT_CREATE`, `CONTENT_UPDATE`, `CONTENT_DELETE`
  - `USER_ROLE_CHANGE`, `USER_PLAN_UPGRADE`
  - `JOB_RETRY`, `JOB_FAILURE`
  - `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILURE`
- **Fields Logged:** `userId`, `action`, `targetType`, `targetId`, `ipAddress`, `metadata`, `createdAt`.

---

## 5. Defense-in-Depth & Header Hardening

1. **Reverse Proxy Security Headers (NGINX / Cloudflare):**
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
   - `X-XSS-Protection: 1; mode=block`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `Content-Security-Policy`: Restricts script and media origins.
2. **Directory Traversal Prevention:**
   - In `/api/stream/media` and `/api/b2/`, all input file paths are sanitized via regex stripping leading slashes and resolving against `process.cwd()/public`. Attempts to traverse outside root are rejected with `400 Bad Request`.
