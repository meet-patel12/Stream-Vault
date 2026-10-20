# 📝 Platform Changelog (`CHANGELOG.md`)

All notable changes to the StreamVault streaming platform are documented in this file.

---

## [3.0.0] - Production Enterprise Release - October 2026

### 🚀 Added
- **Phase 1: Project & Gap Analysis:**
  - Completed exhaustive 22-domain gap analysis documented in `phase1_gap_analysis.md`.
- **Phase 2: Premium UI Upgrade:**
  - Upgraded cinematic homepage with auto-playing hero trailer video, mute/unmute control, and slide indicators.
  - Upgraded `ContentCard` with live video preview on hover, match score algorithm, 4K/HDR tags, and quick action drawer.
  - Implemented Top 10 row (`isTop10={true}`) with Netflix-style giant 3D stroke typography and smooth horizontal scrolling.
  - Built Continue Watching row with real watch progress indicators and resume triggers.
- **Phase 3: Profile System:**
  - Added multi-profile PIN locking with interactive 4-digit keypad verification modal.
  - Added profile preferences (`preferred_language`, `preferred_audio`, `preferred_subtitle`, `autoplay_previews`).
  - Implemented Kids profiles with maturity rating filtering.
- **Phase 4 & 5: Subscription System & Real Payment Gateways:**
  - Database migration adding `subscriptions`, `coupons`, `invoices`, and `payment_transactions` tables.
  - Implemented 5 plan tiers: Free, Basic ($9.99), Standard ($15.49), Premium ($19.99), Family ($24.99).
  - Supported billing cycles: Monthly, Quarterly (10% off), Annual (20% off) with 18% GST itemized calculation.
  - Built real payment gateway drivers: Stripe, Razorpay, PayPal, Apple Pay, and Google Pay with HMAC webhook signature verification.
  - Upgraded Account page with plan switcher, pause/resume/cancel controls, coupon validation, and downloadable GST invoice history.
- **Phase 6: Multi-Codec Video Streaming Upgrade:**
  - Added AV1, H.265 (HEVC), H.264, and VP9 rendition ladders to media encoding pipeline.
  - Implemented automated thumbnail spritesheet generator (`spritesheet.jpg` and `spritesheet.vtt`) for scrub bar previewing.
  - Integrated scene detection and Netflix VMAF verification (`libvmaf`).
- **Phase 7: Premium Player:**
  - Added Skip Intro, Skip Recap, and Next Episode floating marker buttons.
  - Implemented docked Mini Player mode and native Picture-in-Picture (`requestPictureInPicture`).
  - Integrated Chromecast and Apple AirPlay triggers.
  - Added dynamic buffer strategy selector (Low Latency 15s, Balanced 30s, Deep Buffer 60s).
  - Implemented global Netflix keyboard shortcuts HUD modal (`Space`, `F`, `M`, `J`/`L`, `S`, `N`, `P`, `0-9`, `?`).
  - Integrated anti-piracy forensic drifting dynamic user watermark.
- **Phase 8: AI Recommendation Engine:**
  - Built hybrid collaborative filtering and content-based genre affinity vector engine.
  - Added contextual "Because You Watched [Title]" similarity row.
  - Added "Trending Now 🔥" velocity engine and "Most Popular" ranking.
  - Added heuristic Continue Watching ranking engine with time-decay and sweet-spot scoring.
- **Phase 9: Multi-Faceted & Voice Search:**
  - Added Web Speech API voice search with active speech recognition.
  - Added faceted filter drawer: Actor, Director, Genre, Year Range, Min IMDb Rating, Max Duration, and Media Type.
  - Implemented typo-tolerant Levenshtein distance fuzzy search.
- **Phase 10: Watchlist & Custom Playlists:**
  - Added `playlists` and `playlist_items` tables.
  - Implemented Favorites, Watch Later, Thematic Collections, and Custom Playlists.
  - Added public shareable playlists with unique `shareToken` and public landing page (`/playlist/shared/[shareToken]`).
- **Phase 11: Offline Downloads & Smart Sync:**
  - Added `offline_downloads` table.
  - Built Downloads management page with device storage meter (`navigator.storage.estimate()`).
  - Implemented Smart Downloads engine: auto-deletes watched episodes (>88% progress) and auto-queues the next episode.
- **Phase 12: Notifications:**
  - Added `notifications` table and API.
  - Built interactive Notification Drawer in navbar with unread badge counter, category icons, and mark-all-read action.
- **Phase 13: Admin Analytics Dashboard:**
  - Built `/api/admin/analytics` calculating MRR, ARR, ARPU, GST revenue, streaming hours, startup latency, buffer ratio, and gateway breakdowns.
  - Added dedicated Analytics & Revenue tab in Admin Dashboard.
- **Phase 14: Security & Device Management:**
  - Added `user_devices` and `login_history` tables.
  - Implemented RFC 6238 TOTP Two-Factor Authentication (2FA) with 8 single-use recovery codes.
  - Implemented remote device management with "Sign Out All Other Devices" action and session revocation.
- **Phase 15: Performance Optimization:**
  - Configured Gzip & Brotli compression in `next.config.ts`.
  - Added modern AVIF and WebP image optimization pipelines.
  - Created 14 high-throughput B-tree and compound indexes in PostgreSQL Neon DB.
- **Phase 16: Automated Testing:**
  - Implemented unit test suites for pricing engine, TOTP security, and search algorithms.
  - Implemented integration test suite for live PostgreSQL schema verification.
  - Added master test runner (`npm test`) with 100% pass rate.
- **Phase 17: Documentation:**
  - Updated `API.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DEPLOYMENT.md`, `README.md`, and `CHANGELOG.md`.

---

## [2.0.0] - Modernization & Enterprise Architecture Loop - September 2026
- Core Next.js 16 and FastAPI media processing baseline.
