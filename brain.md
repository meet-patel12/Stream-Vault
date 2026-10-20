# 🧠 System Architecture & Engineering Documentation (`brain.md`)
**Platform:** StreamVault (Netflix Enterprise Streaming Platform)  
**Version:** 2.0.0 (Production Multi-Codec Enterprise Edition)  
**Status:** Modernized, Benchmarked, and Production Extended

---

## 📐 1. System Architecture Overview

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
                │ (Drizzle & SQLAlchemy)  │     │   Cache & Rate Limits │       │ SVT-AV1 / H.264 / VMAF  │
                │ Users, Catalog, Metrics │     └───────────────────────┘       │ Shaka Packager DASH/HLS │
                └─────────────────────────┘                                     └─────────────────────────┘
```

---

## 🛠️ 2. Core Stack & Libraries

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend Web App** | Next.js 16, React 19, TailwindCSS v4, Framer Motion | SSR, App Router, responsive Netflix dark mode UI, micro-animations. |
| **Video Player** | Google Shaka Player (`shaka-player` v5.2+), Hls.js | MPEG-DASH & HLS adaptive streaming, non-rebuffering ABR, smart buffering (20s–60s), dynamic intro/credits skip, multi-audio, WebVTT. |
| **Media Server** | FastAPI, Uvicorn, Python 3.11/3.13 | High-throughput async media ingest, upload validation (10 formats), admin API. |
| **Transcoding Engine** | FFmpeg, SVT-AV1, libx264, libvmaf, Shaka Packager | Dual-codec ladder (SVT-AV1 + H.264), SHA-256 file integrity check, scene cut detection (`g=96`), VMAF perceptual checks (93+ target), dual DASH/HLS manifests. |
| **Distributed Cache & Queue**| Redis 7, `ioredis`, Celery, BackgroundTasks | Sub-5ms cache-aside layer, distributed sliding-window rate limiting, job queue state. |
| **Database & ORM** | PostgreSQL 16 / Neon DB, Drizzle ORM, SQLAlchemy 2.0 | Relational catalog, profiles, user credentials, watch history, playback telemetry, audit logs. |
| **AI & Intelligence** | Collaborative filtering, Vector scoring, Levenshtein fuzzy search | Dynamic recommendation engine (`/api/recommendations`), typo-tolerant ranked search (`/api/content/search`). |
| **Observability & Security** | Prometheus (`/api/metrics`), HMAC SHA-256, bcrypt, Audit Logs | Standard Prometheus exposition, constant-time signed URLs, immutable security audit trail. |
| **DevOps & Cloud** | Docker, Docker Compose, Kubernetes, GitHub Actions | Multi-container orchestration, K8s manifests with HPA (2–10 pods), automated CI/CD pipeline. |

---

## 🗄️ 3. Database Schema & Data Models

PostgreSQL schema is unified across **Drizzle ORM** (`src/db/schema.ts`) and **SQLAlchemy** (`media_server/app/models.py`):

1. **`users`**: Credentials, plan tier (`basic`, `standard`, `premium`), role (`admin`, `user`), password reset tokens.
2. **`profiles`**: User profiles (name, avatar color/emoji, `isKids` flag).
3. **`content`**: Movies and series catalog (title, slug, releaseYear, videoKey/DASH, hlsManifestKey/HLS, backdrop/poster URLs, maturityRating, `introStartTime`, `introEndTime`, `creditsStartTime`, `chapters`).
4. **`encoding_jobs`**: Media queue records (`content_id`, `source_file`, `status` [pending/processing/completed/failed], `progress`, `dash_manifest`, `hls_manifest`, `vmaf_scores`, `error_message`).
5. **`playback_telemetry`**: Real-time client QoE streaming events (`sessionId`, `contentId`, `profileId`, `eventType` [startup/buffering/bitrate_change/seek/error/heartbeat], `startupLatencyMs`, `bufferDurationMs`, `currentBitrateBps`, `currentResolution`, `droppedFrames`, `playerEngine`).
6. **`audit_logs`**: Immutable security audit trail (`userId`, `action` [CONTENT_CREATE, USER_ROLE_CHANGE, JOB_RETRY, etc.], `targetType`, `targetId`, `ipAddress`, `metadata`).
7. **`ratings`**: Per-profile 1–5 star reviews linked to content items.
8. **`comments`**: Per-profile discussion comments on movies and episodes.
9. **`watch_history`**: Per-profile playback tracking (`progress_seconds`, `total_seconds`, `completed`).
10. **`my_list`**: Per-profile favorite/watchlist items.

---

## 🎥 4. Video Streaming & Transcoding Pipeline

### A. Media Server Transcoding Pipeline (`media_server/pipeline/`)
Treats original uploads as source files only; never streams raw source files directly:
- **Pre-Transcode File Integrity**: Computes SHA-256 cryptographic hash of source file and validates stream duration/container validity before queuing (`verify_video_integrity()`).
- **Format Ingestion**: Supports `.mp4`, `.mkv`, `.mov`, `.avi`, `.webm`, `.m4v`, `.flv`, `.ts`, `.mpeg`, `.wmv`.
- **Scene Detection**: FFmpeg `select='gt(scene,0.4)'` locates scene cut points for aligned keyframe intervals (`KEYFRAME_INTERVAL = 96`, 4s at 24fps).
- **Dual-Codec Video Ladder**:
  - **SVT-AV1 (Primary High-Efficiency):**
    - `1080p`: 3.2 Mbps, CRF 28, Preset 6
    - `720p`: 1.8 Mbps, CRF 32, Preset 6
    - `480p`: 850 kbps, CRF 36, Preset 7
    - `360p`: 450 kbps, CRF 40, Preset 8
  - **libx264 (Universal Compatibility Fallback):**
    - `1080p_h264`: 4.5 Mbps, CRF 23, Preset faster, High profile
    - `720p_h264`: 2.5 Mbps, CRF 24, Preset faster, High profile
    - `480p_h264`: 1.2 Mbps, CRF 26, Preset faster, High profile
- **Audio & Subtitle Demuxing**: Isolates multi-track AAC audio (stereo / 5.1) and WebVTT subtitle files.
- **VMAF Analysis**: Runs FFmpeg `libvmaf` filter to measure perceptual quality scores per rendition (targeting 93+).
- **Shaka Packager Packaging**: Packages elementary streams into dual **MPEG-DASH (`manifest.mpd`)** and **HLS (`master.m3u8`)** manifests with 4-second segment duration.
- **Asset Generation**: Automatically generates sprite sheet thumbnails and 6-second preview clips.

### B. Google Shaka Player Client (`src/components/player/video-player.tsx`)
- Native support for MPEG-DASH (`.mpd`) and HLS (`.m3u8`).
- **Dynamic Track Discovery**: Auto-detects resolutions, multi-language audio tracks, and WebVTT subtitles directly from manifests.
- **Smart Adaptive Buffering**: Measures network bandwidth via `adaptation` events; dynamically scales buffer goal between 20s (on <1.5 Mbps) and 60s (on >6 Mbps) for optimal memory and stall prevention.
- **Interactive Markers**: Database-driven "Skip Intro" and "Next Episode / Finish" buttons with smooth micro-animations.
- **Non-Rebuffering Quality Switching**: Uses `player.selectVariantTrack(track, false)` to switch resolutions cleanly without resetting timestamps or flushing playback buffers.
- **QoE Telemetry Collector**: Captures startup latency, buffering stalls, bitrate shifts, and 45s health heartbeats, dispatching via `navigator.sendBeacon` to `/api/analytics/playback`.

---

## 🤖 5. AI & Search Engine

### A. Hybrid AI Recommendation Engine (`/api/recommendations`)
- Analyzes profile watch completion (>50% ratio) and positive review ratings (>=4 stars).
- Builds real-time genre and actor affinity vectors.
- Computes content similarity scores against active catalog, filtering already-consumed content.
- Cold-start fallback serves top IMDb-rated titles across diverse genres.
- Cached in Redis (`recommendations:profile:{id}`) for 600s.

### B. Multi-Tier Semantic & Fuzzy Search (`/api/content/search`)
- Tier 1: Exact title match (score 100) and prefix match (score 80).
- Tier 2: Title substring match (score 60).
- Tier 3: Levenshtein fuzzy distance matching (distance <= 2 for words >= 4 chars) to forgive user typos (score 20–25).
- Tier 4: Cast, director, genre, and synopsis keyword matching (scores 10–18).
- Cached in Redis (`search:ranked:{query}`) for 120s.

---

## ⚡ 6. Performance, Caching & Distributed Scaling

- **Redis Cache-Aside Engine (`src/lib/cache.ts`)**:
  - `cachedQuery()` helper wraps database operations with automatic JSON serialization and TTL eviction.
  - Featured content cached for 300s, catalog listings for 180s, content details for 300s, search for 120s.
  - Latency reduced from ~150–250ms to **<5ms** on cache hits.
- **Distributed Sliding-Window Rate Limiting (`src/lib/rate-limit.ts`)**:
  - Redis sorted sets maintain distributed sliding window across all active pods.
  - Seamless memory fallback ensures zero downtime if Redis is temporarily offline.

---

## 📡 7. Observability, Security & DevOps

- **Prometheus Metrics Endpoint (`/api/metrics`)**:
  - Standard Prometheus exposition format.
  - Exposes process memory/heap, database pool connections (total/idle/waiting), catalog counts, encoding queue jobs by status, and ingested playback telemetry events.
- **Security Audit Logging (`src/lib/audit.ts`)**:
  - Asynchronous non-blocking audit logging for administrative content mutations, role changes, and transcode retries.
- **Kubernetes Production Setup (`k8s/`)**:
  - `namespace.yaml`, `configmap.yaml`, `client-admin.yaml` (with HorizontalPodAutoscaler scaling 2–10 pods), `media-server.yaml`, and `ingress.yaml` (with TLS and byte-range proxying).
- **Automated CI/CD (`.github/workflows/ci.yml`)**:
  - Automated linting, TypeScript compilation, Python pipeline tests, and Docker multi-container builds on main/PR.

---

## 📂 8. Directory Map & Key Files

```
Netflix/
├── .github/workflows/ci.yml       # Automated GitHub Actions CI/CD Pipeline
├── docker-compose.yml             # Full-stack multi-container orchestration
├── Dockerfile                     # Next.js production container
├── k8s/                           # Production Kubernetes manifests
│   ├── namespace.yaml             # K8s namespace
│   ├── configmap.yaml             # Shared cluster configuration
│   ├── client-admin.yaml          # Next.js deployment, service & HPA
│   ├── media-server.yaml          # FastAPI deployment & service
│   └── ingress.yaml               # NGINX Ingress Controller rules
├── nginx/
│   └── nginx.conf                 # Edge reverse proxy & streaming segment cache
├── media_server/                  # Python Media & Transcoding Service
│   ├── app/
│   │   ├── main.py                # FastAPI routes (upload, jobs, health, stats)
│   │   ├── models.py              # SQLAlchemy database models
│   │   └── worker.py              # Background transcoding queue worker
│   ├── pipeline/
│   │   ├── config.py              # Dual-codec ladders (AV1 + H.264), CRFs, bitrates
│   │   └── transcoder.py          # Dual-codec engine, SHA-256 integrity, VMAF, Shaka Packager
│   ├── tests/
│   │   └── test_pipeline.py       # Pipeline unit tests (5/5 passing)
│   ├── Dockerfile                 # Media server container with FFmpeg & packager
│   └── requirements.txt           # Python dependencies
├── src/
│   ├── app/
│   │   ├── admin/page.tsx         # Admin dashboard with live Transcode Queue
│   │   ├── api/
│   │   │   ├── analytics/         # Playback QoE telemetry ingestion & summary API
│   │   │   ├── content/           # Content catalog, featured, slug & fuzzy search API
│   │   │   ├── metrics/           # Prometheus metrics exposition API
│   │   │   ├── recommendations/   # Hybrid AI recommendation engine API
│   │   │   └── stream/            # Range streaming & proxy routes
│   │   └── browse/                # Browse catalog, billboards, carousels
│   ├── components/
│   │   └── player/
│   │       ├── player-modal.tsx   # Player overlay container & marker passing
│   │       └── video-player.tsx   # Google Shaka Player (DASH/HLS/ABR/Smart Buffer/QoE)
│   ├── db/
│   │   └── schema.ts              # Drizzle ORM PostgreSQL schema (unified with SQLAlchemy)
│   ├── lib/
│   │   ├── audit.ts               # Security audit logging service
│   │   ├── cache.ts               # Redis cache-aside engine with TTL fallback
│   │   ├── rate-limit.ts          # Distributed sliding-window rate limiter
│   │   └── redis.ts               # Singleton Redis connection pool client
│   └── types/
│       └── index.ts               # Shared TypeScript domain interfaces
├── report.md                      # Comprehensive 12-layer engineering audit report
├── technology-report.md           # 77-technology checklist status report
├── ARCHITECTURE.md                # System architecture blueprint & data flow
├── API.md                         # Complete REST API reference
├── DATABASE.md                    # Database schema and ER diagram
├── SECURITY.md                    # Security policies, token rotation & HMAC
├── DEPLOYMENT.md                  # Deployment runbook (Docker & Kubernetes)
└── CHANGELOG.md                   # Complete chronological platform changelog
```

---

## 🧪 9. Developer & Maintenance Commands

- **Run Dev Next.js**: `npm run dev`
- **Type Checking**: `npm run typecheck`
- **Run Pipeline Tests**: `python -m unittest media_server/tests/test_pipeline.py`
- **Run All via Docker**: `docker compose up --build`
- **Scrape Prometheus Metrics**: `curl http://localhost:3000/api/metrics`
- **Database Migrations**: `npx drizzle-kit push`
- **Deploy to Kubernetes**: `kubectl apply -f k8s/`
