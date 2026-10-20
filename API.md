# 📡 StreamVault REST & Streaming API Reference (`API.md`)
**Version:** 3.0.0 (Production Enterprise Release)  
**Authentication:** Cookie-based JWT Access Token (`access_token`, 15-minute expiry) with automated Refresh Token rotation (`refresh_token`, 30-day expiry), TOTP 2FA, and device session revocation.

---

## 🔐 1. Authentication, 2FA & Session Security

### `POST /api/auth/register`
- **Body:** `{ "email": "user@example.com", "password": "SecurePassword123" }`
- **Response:** `200 OK` `{ success: true, data: { user: User, defaultProfile: Profile } }`

### `POST /api/auth/login`
- **Body:** `{ "email": "user@example.com", "password": "SecurePassword123" }`
- **Rate Limit:** 15 requests per 15 minutes.
- **Response:** `200 OK` `{ success: true, data: { user: User, profiles: Profile[] } }`

### `POST /api/auth/logout`
- **Response:** `200 OK` Clears cookies and revokes active refresh token.

### `GET /api/auth/me`
- **Response:** `200 OK` Returns currently authenticated user and profiles.

### `POST /api/auth/2fa/setup`
- **Response:** `200 OK` `{ success: true, data: { secret, otpauthUrl, backupCodes, qrCodeData } }`
- **Description:** Initiates RFC 6238 TOTP setup, generating a Base32 secret and 8 single-use recovery codes.

### `POST /api/auth/2fa/verify`
- **Body:** `{ "code": "123456" }`
- **Response:** `200 OK` `{ success: true, data: { twoFactorEnabled: true } }`
- **Description:** Validates 6-digit TOTP code with clock-drift window tolerance and activates 2FA on user account.

### `POST /api/auth/2fa/disable`
- **Body:** `{ "password"?: string, "code"?: string }`
- **Response:** `200 OK` Disables 2FA on account.

### `GET /api/auth/devices`
- **Response:** `200 OK` `{ success: true, data: { devices: UserDevice[] } }`
- **Description:** Lists registered devices, marking current session, device type (desktop/mobile/tv), IP, and last active timestamp.

### `DELETE /api/auth/devices?id={id}` or `?revokeAllOthers=true`
- **Response:** `200 OK` Revokes specific device or immediately invalidates all other active sessions and refresh tokens.

### `GET /api/auth/login-history`
- **Response:** `200 OK` `{ success: true, data: { history: LoginHistoryItem[] } }`

---

## 👤 2. Profile Management & Parental Controls

### `GET /api/profiles`
- **Response:** `200 OK` `{ success: true, data: Profile[] }`

### `POST /api/profiles`
- **Body:** `{ "name": "Jane", "avatarColor": "#0080ff", "avatarEmoji": "🚀", "isKids": false, "pin": "1234", "preferredLanguage": "en", "preferredAudio": "original", "preferredSubtitle": "off" }`
- **Response:** `200 OK` Creates new profile with bcrypt hashed PIN.

### `POST /api/profiles/[id]/verify-pin`
- **Body:** `{ "pin": "1234" }`
- **Response:** `200 OK` `{ success: true, data: { verified: true, profile: Profile } }`

---

## 💳 3. Subscriptions, Coupons & Multi-Gateway Payments

### `GET /api/subscriptions/current`
- **Response:** `200 OK` Returns active subscription, plan tier, billing cycle, status (active/paused/canceled), and itemized GST invoice history.

### `POST /api/subscriptions/checkout`
- **Body:** `{ "plan": "premium", "billingCycle": "annual", "currency": "USD", "gateway": "stripe", "couponCode": "STREAM50" }`
- **Supported Gateways:** Stripe, Razorpay, PayPal, Apple Pay, Google Pay.
- **Tiers:** Free ($0), Basic ($9.99), Standard ($15.49), Premium ($19.99), Family ($24.99).
- **Billing Cycles:** Monthly, Quarterly (10% off), Annual (20% off). Includes 18% GST itemization.
- **Response:** `200 OK` `{ success: true, data: { checkoutUrl, orderId, pricingBreakdown } }`

### `POST /api/subscriptions/pause` & `POST /api/subscriptions/resume`
- **Response:** `200 OK` Toggles subscription status without terminating billing history.

### `POST /api/subscriptions/cancel`
- **Response:** `200 OK` Cancels recurring renewals while maintaining access until period end.

### `POST /api/coupons/validate`
- **Body:** `{ "code": "STREAM50", "plan": "premium", "cycle": "monthly", "currency": "USD" }`
- **Response:** `200 OK` Returns verified discount value and updated grand total.

### `POST /api/webhooks/stripe` & `POST /api/webhooks/razorpay`
- **Headers:** Stripe Signature / Razorpay HMAC SHA256 Signature.
- **Description:** Verifies webhook cryptographic signature, provisions subscription, records transaction, and generates GST invoice.

---

## 🎬 4. Content, Search & AI Recommendation APIs

### `GET /api/content`
- **Query Params:** `type`, `genre`, `limit`, `offset`.
- **Cache:** Redis cached for 180 seconds.

### `GET /api/content/[slug]`
- **Response:** `200 OK` Returns content details, genres, and episodes.

### `GET /api/content/[slug]/similar?limit={n}`
- **Features:** Content-based vector similarity (Genre Jaccard index + Cast/Director overlap + Rating proximity).

### `GET /api/content/search?q={query}&genre={g}&type={t}&minRating={r}&yearMin={y1}&yearMax={y2}&durationMax={m}`
- **Features:** Multi-faceted instant & fuzzy search, Web Speech API voice query support, typo-tolerant Levenshtein distance scoring.

### `GET /api/recommendations?profileId={id}&type=personalized|trending|popular|because_you_watched&limit={n}`
- **Algorithms:**
  - `personalized`: Collaborative filtering + genre affinity vector scoring.
  - `trending`: Velocity engine based on recent watch events & ratings.
  - `popular`: Highest rated catalog items.
  - `because_you_watched`: Contextual similarity based on user's last watched title.

### `GET /api/watch/continue-watching?profileId={id}`
- **Features:** Netflix heuristic ranking engine incorporating recency time-decay and engagement sweet-spot scoring (15% - 85% progress boosted, end credits suppressed).

---

## 📁 5. Watchlist, Custom Playlists & Shared Collections

### `GET /api/playlists?profileId={id}&type={type}`
- **Response:** `200 OK` Returns user playlists (custom, favorites, watch_later, collections) with item counts and preview thumbnails.

### `POST /api/playlists`
- **Body:** `{ "profileId": 1, "name": "Weekend Sci-Fi", "description": "...", "type": "custom", "isPublic": true }`
- **Response:** `200 OK` Generates unique public `shareToken`.

### `GET /api/playlists/[id]` & `PATCH /api/playlists/[id]` & `DELETE /api/playlists/[id]`
- **Description:** Manages playlist metadata and items.

### `POST /api/playlists/[id]/items` & `DELETE /api/playlists/[id]/items?contentId={id}`
- **Description:** Adds and removes items from a playlist.

### `GET /api/playlists/shared/[shareToken]`
- **Response:** `200 OK` Public endpoint returning curated playlist and content without authentication requirement.

---

## 📲 6. Offline Downloads & Smart Sync

### `GET /api/downloads?profileId={id}`
- **Response:** `200 OK` Returns downloaded titles, quality (720p/1080p/4K), estimated file sizes, 30-day expiration, and total device storage bytes.

### `POST /api/downloads`
- **Body:** `{ "profileId": 1, "contentId": 42, "episodeId": null, "quality": "1080p" }`
- **Response:** `200 OK` Registers local download record.

### `POST /api/downloads/smart-sync`
- **Body:** `{ "profileId": 1, "autoDeleteWatched": true, "autoDownloadNext": true }`
- **Response:** `200 OK` Automatically frees storage by deleting finished episodes (>88% progress) and pre-queuing the next series episode.

---

## 🔔 7. Notifications

### `GET /api/notifications?profileId={id}`
- **Response:** `200 OK` `{ success: true, data: { notifications: NotificationItem[], unreadCount: number } }`
- **Types:** `new_release`, `continue_watching`, `recommendation`, `subscription`, `payment`, `system`.

### `PATCH /api/notifications`
- **Body:** `{ "id"?: number, "markAllRead"?: boolean }`
- **Response:** `200 OK` Updates unread state.

---

## 👑 8. Admin & Streaming Analytics

### `GET /api/admin/analytics`
- **Role:** Admin only.
- **Metrics Computed:**
  - **Financial:** Total Revenue, MRR, ARR, ARPU, GST collected, Refunds.
  - **Streaming QoE:** Total streamed hours, Startup latency (ms), Rebuffer ratio (%), Bitrate (Mbps), CDN Cache hit ratio (96.8%), Concurrent streams estimate.
  - **Subscriber Health:** Active vs Paused vs Canceled counts, Churn rate (%).
  - **Transcoding Pipeline:** Job health, queue status, codec support (AV1, H.265, H.264, VP9).
  - **Payment Gateways:** Success rate (%), volume by gateway.
