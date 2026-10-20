# 🏛️ StreamVault Distributed System Architecture (`ARCHITECTURE.md`)
**Role:** Principal Video Streaming Architect & Principal Distributed Systems Engineer  
**Version:** 3.0.0 (Production Multi-Codec Enterprise Edition)

---

## 1. High-Level Distributed Architecture

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │                NGINX Edge Reverse Proxy                │
                                  │        (Port 80/443 - SSL, CORS, Chunk Caching)        │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
                             ┌────────────────────────────────┴───────────────────────────────┐
                             │                                                                │
                             ▼                                                                ▼
                ┌─────────────────────────┐                                     ┌─────────────────────────┐
                │   Client & Admin App    │                                     │   Media Server API      │
                │  Next.js 16 / React 19  │                                     │     FastAPI / Uvicorn   │
                │  Shaka Player / Zustand │                                     │  Uploads & Job Queue    │
                └────────────┬────────────┘                                     └────────────┬────────────┘
                             │                                                               │
                             ├────────────────────────────────┐                              │
                             ▼                                ▼                              ▼
                ┌─────────────────────────┐     ┌───────────────────────┐       ┌─────────────────────────┐
                │     PostgreSQL DB       │◄────┤  Redis Distributed    │◄──────┤  Transcoding Pipeline   │
                │ (Drizzle & SQLAlchemy)  │     │   Cache & Rate Limits │       │ SVT-AV1 / H.265 / VP9   │
                │ Users, Catalog, Metrics │     └───────────────────────┘       │ Shaka Packager DASH/HLS │
                └─────────────────────────┘                                     └─────────────────────────┘
```

---

## 2. Core Subsystem Architectures

### 1. Multi-Codec Video Streaming Engine (AV1, H.265, H.264, VP9)
- **Encoding Renditions:**
  - `AV1` via `libsvtav1`: 50% bandwidth savings over H.264 for mobile & 4K streams.
  - `H.265 (HEVC)` via `libx265`: High dynamic range (HDR) 4K/1080p profile with preset `medium`.
  - `VP9` via `libvpx-vp9`: Native Chromium & smart TV optimization.
  - `H.264` via `libx264`: Universal fallback profile.
- **Scrub Bar Thumbnail Spritesheet:**
  - Automated generation of `spritesheet.jpg` (25-frame tiles, 160x90 per thumbnail) and WebVTT cue file `spritesheet.vtt` for live preview scrubbing.
- **Perceptual Quality Verification:**
  - Shot-based scene detection and Netflix VMAF verification (`libvmaf`, target score > 92.0).

### 2. Premium Player Engine (Shaka Player v5.2+)
- **Interactive Playback UX:**
  - Floating "Skip Intro", "Skip Recap", and "Next Episode" markers.
  - Picture-in-Page Mini Player & Native Picture-in-Picture (`requestPictureInPicture`).
  - Google Cast (Chromecast) and Apple AirPlay integration.
  - Dynamic Anti-Piracy Watermarking: Forensic drifting user watermark.
  - Global Netflix Keyboard Shortcuts HUD overlay (`Space`, `F`, `M`, `J`/`L`, `S`, `N`, `P`, `0-9`, `?`).

### 3. AI Recommendation & Content Similarity Engine
- **Hybrid Collaborative & Content-Based Vector Scoring:**
  - Computes user genre affinity vectors based on watched history (>50% completion) and 4+ star ratings.
  - Contextual "Because You Watched [Title]" similarity based on cosine/Jaccard genre overlap.
  - High-velocity "Trending Now" calculation using 7-day watch activity.
  - Continue Watching Heuristic Ranking with recency half-life time-decay and engagement sweet-spot scoring (15% - 85% progress boosted, end credits discounted).

### 4. Search Architecture
- Multi-faceted query parsing supporting Actor, Director, Genre, Year Range, Min IMDb Rating, Max Duration, and Media Type.
- Web Speech API voice search with real-time speech recognition.
- Levenshtein distance typo tolerance for instant instant-as-you-type results.

### 5. Multi-Gateway Payment Engine
- Direct RESTful integration supporting Stripe, Razorpay, PayPal, Apple Pay, and Google Pay.
- Cryptographic webhook HMAC signature verification with replay attack prevention.
- 18% GST tax calculation with automated itemized billing invoices.
- Plan lifecycle management: Upgrade, Downgrade, Pause, Resume, and Coupon discounting.

### 6. Security & Session Revocation
- Cookie-based JWT Access Token (15 min) with automated single-use Refresh Token rotation (30 days).
- RFC 6238 Time-Based One-Time Password (TOTP) Two-Factor Authentication with 8 single-use recovery backup codes.
- Device fingerprinting and session management with instant remote revocation (`refresh_token_version` bump).
- Login audit trail logging IP address, user-agent, and authorization status.

### 7. Offline Download Manager & Smart Sync
- IndexedDB / CacheStorage client blob caching with quality selection (720p, 1080p, 4K).
- Smart Downloads automation: auto-deletes watched episodes (>88% progress) and pre-fetches the next series episode.
- Device storage quota estimation meter (`navigator.storage.estimate()`).
