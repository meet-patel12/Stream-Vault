# 🎬 StreamVault - Enterprise Video Streaming Platform

[![Next.js 16](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?style=for-the-badge&logo=kubernetes)](https://kubernetes.io/)

> **StreamVault** is an enterprise-grade, full-stack video streaming and content delivery platform engineered to replicate and elevate the architecture of modern streaming giants like Netflix. Architected as a high-throughput, microservice-driven ecosystem, StreamVault bridges an ultra-responsive client experience with a resilient, distributed media encoding and delivery pipeline.

---

## 📖 Table of Contents
- [✨ Key Highlights & Features](#-key-highlights--features)
- [🏛️ System Architecture](#️-system-architecture)
- [💻 Tech Stack](#-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Quick Start & Local Setup](#-quick-start--local-setup)
- [🐳 Docker & Kubernetes Deployment](#-docker--kubernetes-deployment)
- [🧪 Automated Test Suite](#-automated-test-suite)
- [📚 Documentation Index](#-documentation-index)
- [📄 License](#-license)

---

## ✨ Key Highlights & Features

### 1. 🍿 Cinematic Video Player & Multi-Codec Streaming
- **Multi-Codec Encoding Ladder**: Multi-bitrate streaming supporting AV1 (`libsvtav1`), H.265/HEVC (`libx265`), VP9 (`libvpx-vp9`), and universal H.264 high-profile fallback.
- **Adaptive Bitrate Streaming (ABR)**: Native Google Shaka Player (`v5.2+`) integration with Hls.js fallback supporting dual DASH (`manifest.mpd`) and HLS (`master.m3u8`).
- **Interactive Playback Overlay**: Dynamic "Skip Intro", "Skip Recap", and "Next Episode" markers with automated cue detection.
- **Scrub Bar Thumbnail Sprites**: Hoverable seek-bar previews powered by WebVTT and automated FFmpeg spritesheets.
- **Picture-in-Picture & Casting**: Native Picture-in-Picture (`requestPictureInPicture`), corner mini-player, Google Cast (Chromecast), and Apple AirPlay.
- **Forensic Anti-Piracy Watermarking**: Dynamically drifting, semi-transparent user session watermarks.

### 2. 🤖 Hybrid AI Recommendation Engine
- **Vector-Based Affinity Scoring**: Calculates user genre vectors using completion rates (>50%) and 4+ star user ratings.
- **Contextual Recommendation Rows**: "Because You Watched [Title]" rows powered by Jaccard and cosine similarity models.
- **Trending Velocity**: Dynamic "Trending Now 🔥" row evaluating 7-day watch activity decay algorithms.
- **Heuristic Continue Watching**: Recency half-life decay formula prioritizing active engagement (15%-85% progress) over finished end credits.

### 3. 🔍 Multi-Faceted & Voice-Assisted Search
- **Web Speech API Voice Search**: Real-time microphone speech recognition embedded directly in the search drawer.
- **Faceted Filter Drawer**: Dynamic filtering by Actor, Director, Genre, Year Range, Min IMDb Rating (7+, 8+, 8.5+), Max Duration, and Media Type.
- **Instant Typo-Tolerant Search**: Levenshtein distance fuzzy search with under 250ms debounced queries.

### 4. 💳 Multi-Tier Subscriptions & Payment Gateways
- **5 Subscription Plan Tiers**: Free ($0), Basic ($9.99), Standard ($15.49), Premium ($19.99), and Family ($24.99).
- **Flexible Billing Cycles**: Monthly, Quarterly (10% discount), and Annual (20% discount).
- **Tax Compliance & Invoicing**: Automatic 18% GST calculation with itemized, downloadable PDF/HTML tax invoices.
- **Real Gateway Integrations**: Stripe, Razorpay, and PayPal with HMAC-verified webhooks and 1-click plan upgrades, pauses, and cancellations.

### 5. 👥 Multi-Profile & Parental Control System
- **Profile PIN Protection**: 4-digit PIN lock with an interactive keypad modal and salted bcrypt hashing.
- **Dedicated Kids Experience**: Age-appropriate maturity rating lockouts and tailored catalog views.
- **Independent Preferences**: Per-profile language, audio track, subtitle preferences, and auto-play toggles.

### 6. 🛡️ Enterprise Security & Session Management
- **Two-Factor Authentication (2FA)**: RFC 6238 TOTP engine compatible with Google Authenticator, Authy, and 1Password with 8 single-use recovery codes.
- **Token Rotation & Revocation**: 15-minute JWT Access Tokens with cryptographically hashed Refresh Tokens and instant global revocation.
- **Device & Session Auditing**: Real-time connected device manager displaying active IP, device OS, browser, and remote "Sign Out All Devices" action.
- **Signed Media URLs**: Constant-time HMAC SHA-256 token verification preventing stream hotlinking and unauthorized playback.

### 7. 📲 Offline Downloads & Storage Management
- **Offline Download Manager**: IndexedDB / CacheStorage video caching with 720p, 1080p, and 4K quality options.
- **Smart Downloads Automation**: Automatically deletes finished episodes (>88% watched) and pre-fetches the next episode in the series.
- **Storage Capacity Meter**: Real-time device quota calculation via `navigator.storage.estimate()`.

### 8. 👑 Admin & Financial Telemetry Dashboard
- **Revenue KPIs**: Monthly Recurring Revenue (MRR), Annual Run Rate (ARR), ARPU, GST collected, and refund volume.
- **Streaming QoE Telemetry**: Real-time startup latency (ms), rebuffer ratio (<0.4%), average bitrate, and CDN edge cache hit ratios.
- **Encoding Job Monitor**: Live transcoding queue tracking progress, status, and VMAF perceptual quality scores with single-click retry.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    Client["Client Devices (Web, TV, Mobile)"]
    NGINX["NGINX Edge Proxy / Load Balancer"]
    NextServer["Next.js 16 Web & API Server"]
    MediaServer["FastAPI Media Microservice (Python)"]
    Postgres[("PostgreSQL Database (Drizzle ORM)")]
    RedisCache[("Redis Cache & Rate Limiter")]
    Storage["Cloudflare CDN & Backblaze B2 S3"]

    Client -->|HTTPS / WSS| NGINX
    NGINX -->|Reverse Proxy :3000| NextServer
    NGINX -->|Transcode & Upload :8000| MediaServer
    
    NextServer -->|Cache-Aside & Rate Limiting| RedisCache
    NextServer -->|Relational Queries & Auth| Postgres
    NextServer -->|Signed Media URLs| Storage

    MediaServer -->|FFmpeg / AV1 / H.264 / Shaka| Storage
    MediaServer -->|Job Status & Metadata| Postgres
    MediaServer -->|Event Pub/Sub| RedisCache

    Storage -->|HLS & DASH Adaptive Streams| Client
```

---

## 💻 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Styling & Animation** | [TailwindCSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) |
| **Player Engine** | [Google Shaka Player v5.2](https://github.com/shaka-project/shaka-player), [Hls.js](https://github.com/video-dev/hls.js) |
| **Media Processing** | [FastAPI](https://fastapi.tiangolo.com/), [FFmpeg](https://ffmpeg.org/), [SVT-AV1](https://gitlab.com/AOMediaCodec/SVT-AV1), [Shaka Packager](https://github.com/shaka-project/shaka-packager), `libvmaf` |
| **Database & ORM** | [PostgreSQL 16](https://www.postgresql.org/), [Drizzle ORM](https://orm.drizzle.team/), `asyncpg`, `SQLAlchemy` |
| **Caching & Messaging** | [Redis 7](https://redis.io/), `ioredis`, [Celery](https://docs.celeryq.dev/) |
| **Payment Gateways** | Stripe, Razorpay, PayPal, Apple Pay, Google Pay |
| **Security & Auth** | Jose (JWT), Bcrypt, RFC 6238 TOTP (2FA), HMAC-SHA256 Signed URLs |
| **DevOps & Cloud** | [Docker](https://www.docker.com/), [Kubernetes](https://kubernetes.io/), [NGINX](https://nginx.org/), Cloudflare Workers, Backblaze B2 |

---

## 📁 Project Structure

```text
├── cloudflare/          # Cloudflare Worker edge proxy manifests
├── docs/                # Comprehensive engineering and module specifications
├── k8s/                 # Kubernetes deployment, service, ingress, and config manifests
├── media_server/        # Python FastAPI transcoding & packaging microservice
│   ├── app/             # FastAPI routes, schemas, and Celery workers
│   └── pipeline/        # FFmpeg multi-codec ladders & Shaka packaging scripts
├── nginx/               # NGINX reverse proxy & load balancing configurations
├── public/              # Static media, spritesheets, and asset bundles
├── scripts/             # Database migration and optimization scripts
├── src/
│   ├── app/             # Next.js App Router (Client, Player, Admin, Auth, APIs)
│   ├── components/      # Reusable UI, Player, Modal, and Navigation components
│   └── lib/             # Cache-aside, rate-limiting, DB client, and security helpers
├── tests/               # Automated test suites for auth, payments, search, and DB
├── docker-compose.yml   # Multi-container orchestration (Web, FastAPI, Postgres, Redis)
└── Dockerfile           # Production multi-stage Docker build for Next.js web server
```

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **Python**: `v3.11+`
- **Docker & Docker Compose** (Recommended for PostgreSQL and Redis)
- **FFmpeg**: Compiled with `libsvtav1`, `libx264`, and `libvmaf`

### 2. Clone and Configure Environment
```bash
git clone https://github.com/meet-patel12/Netflix.git
cd Netflix
cp .env.example .env
```

Ensure your `.env` contains valid credentials for database, Redis, and secret keys:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/netflix
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=your-super-secure-jwt-secret-key-32-chars
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-32-chars
HMAC_SECRET_KEY=your-streaming-signed-url-secret
```

### 3. Start Database & Cache
```bash
docker-compose up -d postgres redis
```

### 4. Install Dependencies & Run Migrations
```bash
# Install frontend dependencies
npm install

# Run database schema migrations
node scripts/migrate-profiles.js
node scripts/migrate-subscriptions.js
node scripts/migrate-phases8-14.js
node scripts/optimize-indexes.js
```

### 5. Launch Development Services
```bash
# Terminal 1: Start Next.js Web App & Client APIs
npm run dev

# Terminal 2: Start Media Processing Microservice (Optional for transcoding)
cd media_server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open [http://localhost:3000](http://localhost:3000) to access StreamVault.

---

## 🐳 Docker & Kubernetes Deployment

### Full-Stack Docker Compose
Run all services (Next.js, FastAPI, PostgreSQL, Redis, and NGINX) with a single command:
```bash
docker-compose up --build -d
```

### Kubernetes Orchestration
Production deployment manifests are located in `k8s/`:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/media-server-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## 🧪 Automated Test Suite

StreamVault features an automated test runner validating critical database models, payments, security TOTP, and search indexing:

```bash
# Run the complete test suite
npm test

# Type-check TypeScript codebase
npm run typecheck

# Run linter
npm run lint
```

---

## 📚 Documentation Index

For deep-dive technical specifications and architectural workflows:
- [API Documentation (`API.md`)](./API.md) — Comprehensive REST and streaming endpoint contracts.
- [Architecture Blueprint (`ARCHITECTURE.md`)](./ARCHITECTURE.md) — Detailed 12-layer streaming engine breakdown.
- [Database Schema & ER Models (`DATABASE.md`)](./DATABASE.md) — Drizzle ORM models, relational indexes, and schemas.
- [Deployment & Cloud Runbook (`DEPLOYMENT.md`)](./DEPLOYMENT.md) — NGINX, Cloudflare Workers, B2 proxy, and CI/CD.
- [Security Protocol (`SECURITY.md`)](./SECURITY.md) — Cryptographic standards, HMAC signed URLs, and 2FA policies.
- [Changelog & Milestones (`CHANGELOG.md`)](./CHANGELOG.md) — Chronological history of all 17 feature phases.
- [Engineering Audit Report (`report.md`)](./report.md) — Comprehensive system audit and QoE benchmarks.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE). Built for enterprise demonstration and educational streaming systems research.
