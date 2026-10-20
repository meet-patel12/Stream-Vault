# 🚀 StreamVault Deployment, Environment Setup & Troubleshooting Guide

| Metadata | Details |
| :--- | :--- |
| **Title** | Deployment Runbook, Environment Configuration, Troubleshooting & Glossary |
| **Document ID** | DEP-001 |
| **Version** | 2.0.0 (Production Multi-Codec Enterprise Edition) |
| **Author** | Principal DevOps Engineer & Cloud Architect |
| **Date** | 2026-09-29 |
| **Purpose** | Step-by-step developer and operations guide covering environment variables, local Docker setup, Kubernetes installation, troubleshooting procedures, FAQ, and technical glossary. |
| **Scope** | Platform deployment environments (`docker-compose.yml`, `k8s/`, `.env.example`). |

---

## 📑 Table of Contents

- [1. Environment Setup & Prerequisites](#1-environment-setup--prerequisites)
- [2. Quickstart Installation via Docker Compose](#2-quickstart-installation-via-docker-compose)
- [3. Bare-Metal & Local Development Setup](#3-bare-metal--local-development-setup)
- [4. Kubernetes Production Deployment](#4-kubernetes-production-deployment)
- [5. Troubleshooting & Diagnostic Runbook](#5-troubleshooting--diagnostic-runbook)
- [6. Frequently Asked Questions (FAQ)](#6-frequently-asked-questions-faq)
- [7. Technical Streaming Glossary](#7-technical-streaming-glossary)
- [8. Cross References](#8-cross-references)

---

## 1. Environment Setup & Prerequisites

### Required Software:
- **Node.js**: v20.0+ (LTS) or v22.0+
- **Python**: v3.11+
- **Docker Engine**: v24.0+ and Docker Compose v2.20+
- **PostgreSQL**: v16.0+
- **Redis**: v7.0+
- **FFmpeg**: v6.0+ with `libsvtav1`, `libx264`, and `libvmaf` compiled
- **Google Shaka Packager**: v3.0+

### Environment Configuration (`.env`):
```ini
# PostgreSQL Relational Persistence
DATABASE_URL="postgresql://postgres:password@localhost:5432/netflix"

# Redis Distributed Cache & Rate Limiting
REDIS_URL="redis://localhost:6379/0"

# Cryptographic & Session Secrets
JWT_ACCESS_SECRET="generate-32-character-random-hex-string-for-access"
JWT_REFRESH_SECRET="generate-32-character-random-hex-string-for-refresh"
CDN_SECRET_KEY="generate-32-character-hmac-secret-key-for-playback"

# External CDN & Storage (Optional)
CDN_BASE_URL="https://stream.streamvault.tv"
B2_APPLICATION_KEY_ID=""
B2_APPLICATION_KEY=""
B2_BUCKET_NAME=""
```

---

## 2. Quickstart Installation via Docker Compose

```bash
# Clone the repository
git clone https://github.com/example/streamvault.git
cd streamvault

# Build and start all 5 multi-container services
docker compose up --build -d

# Verify all containers are healthy
docker compose ps
```

Access Points:
- **Web Application & Edge Proxy**: [http://localhost](http://localhost) (Port 80)
- **FastAPI Media Server Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs) (Port 8000)
- **Prometheus Metrics Endpoint**: [http://localhost/api/metrics](http://localhost/api/metrics)
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

---

## 3. Bare-Metal & Local Development Setup

### 3.1 Next.js Web Client & API
```bash
# Install npm dependencies
npm install

# Push database schema to PostgreSQL
npx drizzle-kit push

# Seed initial catalog content
node scripts/seed.mjs

# Launch development server
npm run dev
```

### 3.2 FastAPI Media Server & Transcoder
```bash
# Install Python dependencies
python -m pip install -r media_server/requirements.txt

# Run pipeline unit tests (5 passing tests)
python -m unittest media_server/tests/test_pipeline.py

# Launch FastAPI development server
uvicorn media_server.app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 4. Kubernetes Production Deployment

```bash
# 1. Create namespace
kubectl apply -f k8s/namespace.yaml

# 2. Apply shared configuration
kubectl apply -f k8s/configmap.yaml

# 3. Create production secrets
kubectl create secret generic streamvault-secrets \
  --namespace=streamvault \
  --from-literal=DATABASE_URL="postgresql://user:pass@db:5432/netflix" \
  --from-literal=JWT_ACCESS_SECRET="your-access-secret" \
  --from-literal=JWT_REFRESH_SECRET="your-refresh-secret" \
  --from-literal=CDN_SECRET_KEY="your-cdn-secret"

# 4. Deploy web app with HorizontalPodAutoscaler
kubectl apply -f k8s/client-admin.yaml

# 5. Deploy media server
kubectl apply -f k8s/media-server.yaml

# 6. Apply Ingress with TLS and CORS
kubectl apply -f k8s/ingress.yaml

# 7. Monitor rollout status
kubectl rollout status deployment/streamvault-client-admin -n streamvault
```

---

## 5. Troubleshooting & Diagnostic Runbook

### Issue 1: "Shaka Player failed to load manifest"
- **Cause**: NGINX missing CORS headers or file permissions issue on `/public/stream_assets/`.
- **Fix**: Verify NGINX container volume mount and check CORS header:
  ```bash
  curl -I http://localhost/stream_assets/14/manifest.mpd
  ```
  Ensure `Access-Control-Allow-Origin: *` is present.

### Issue 2: Transcode Job Stuck in "processing"
- **Cause**: Out of memory (OOM) during SVT-AV1 encoding or missing FFmpeg binary.
- **Fix**: Inspect media server logs:
  ```bash
  docker logs -f netflix-media-server
  ```
  Check `error_message` column in PostgreSQL `encoding_jobs` table.

### Issue 3: Rate Limit Exceeded (HTTP 429) During Load Testing
- **Cause**: Client IP exceeded sliding window threshold.
- **Fix**: Flush Redis rate limit keys:
  ```bash
  docker exec -it netflix-redis redis-cli KEYS "telemetry:*" | xargs docker exec -it netflix-redis redis-cli DEL
  ```

---

## 6. Frequently Asked Questions (FAQ)

#### Q: Why are uploads not streamed immediately?
**A**: StreamVault enforces broadcast quality standards. Master uploads must undergo pre-transcode integrity checking, scene detection, dual-codec encoding (AV1 + H.264), and VMAF 93+ verification to guarantee adaptive bitrate performance.

#### Q: How does the platform handle users whose browsers do not support AV1?
**A**: Shaka Packager embeds both SVT-AV1 and libx264 AdaptationSets into the same `manifest.mpd` and `master.m3u8`. If a client browser lacks an AV1 decoder, Shaka Player seamlessly filters the variant tracks and streams the libx264 High Profile rendition.

#### Q: How does "Skip Intro" work?
**A**: Content items specify `introStartTime` and `introEndTime` in seconds. The player listens to `timeupdate` events and renders an interactive button when the playback clock enters that window, seeking instantly to the end timestamp when clicked.

---

## 7. Technical Streaming Glossary

- **ABR (Adaptive Bitrate Streaming)**: Technique where the client dynamically switches video renditions based on real-time network throughput.
- **CMAF (Common Media Application Format)**: Standard container format enabling shared chunk fragmentation across DASH and HLS.
- **CRF (Constant Rate Factor)**: Encoding mode that varies bitrate to maintain consistent perceptual visual quality.
- **DASH (Dynamic Adaptive Streaming over HTTP)**: International standard (ISO/IEC 23009-1) for adaptive HTTP video delivery.
- **EME (Encrypted Media Extensions)**: W3C standard API enabling web browsers to interact with Digital Rights Management (DRM) systems.
- **HLS (HTTP Live Streaming)**: Apple's HTTP-based adaptive streaming communications protocol.
- **IDR (Instantaneous Decoder Refresh)**: A special video keyframe that prevents subsequent frames from referencing prior frames, allowing clean rendition switches.
- **MSE (Media Source Extensions)**: HTML5 API allowing JavaScript to construct media streams dynamically for `<video>` elements.
- **QoE (Quality of Experience)**: Measure of user viewing satisfaction based on startup latency, rebuffering frequency, and visual quality.
- **SVT-AV1**: Scalable Video Technology for AV1; modern, highly efficient open-source encoder.
- **VMAF (Video Multi-Method Assessment Fusion)**: Perceptual video quality assessment algorithm developed by Netflix.

---

## 8. Cross References

- [Master Documentation Hub](file:///d:/clg/Projects/Netflix/docs/README.md)
- [System Architecture](file:///d:/clg/Projects/Netflix/docs/system_architecture.md)
- [DevOps & CI/CD Guide](file:///d:/clg/Projects/Netflix/docs/devops_and_ci_cd.md)
- [Admin Operations Guide](file:///d:/clg/Projects/Netflix/docs/admin_operations_guide.md)
