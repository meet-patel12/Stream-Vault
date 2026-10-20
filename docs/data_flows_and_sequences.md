# 🔄 StreamVault Data Flows, Control Flows & Sequence Diagrams

| Metadata | Details |
| :--- | :--- |
| **Title** | StreamVault Data Flows, Sequences & State Transitions |
| **Document ID** | ARCH-002 |
| **Version** | 2.0.0 (Production Multi-Codec Enterprise Edition) |
| **Author** | Principal Software Architect & Lead Systems Modeler |
| **Date** | 2026-09-29 |
| **Purpose** | Visual and technical specification of system interaction protocols, end-to-end sequence diagrams, state machines, and data lifecycles. |
| **Scope** | Core operational flows including authentication, upload and transcoding pipeline, adaptive media playback, client telemetry ingestion, and interactive content markers. |

---

## 📑 Table of Contents

- [1. End-to-End Data Lifecycle](#1-end-to-end-data-lifecycle)
- [2. System Interaction Sequence Diagrams](#2-system-interaction-sequence-diagrams)
  - [2.1 Authentication & Token Rotation Sequence](#21-authentication--token-rotation-sequence)
  - [2.2 Ingestion & Asynchronous Transcoding Sequence](#22-ingestion--asynchronous-transcoding-sequence)
  - [2.3 Adaptive Playback & Manifest Negotiation Sequence](#23-adaptive-playback--manifest-negotiation-sequence)
  - [2.4 Interactive Content Marker ("Skip Intro") Sequence](#24-interactive-content-marker-skip-intro-sequence)
  - [2.5 Real-Time QoE Telemetry Ingestion Sequence](#25-real-time-qoe-telemetry-ingestion-sequence)
- [3. System State Machines](#3-system-state-machines)
  - [3.1 Encoding Job State Lifecycle](#31-encoding-job-state-lifecycle)
  - [3.2 Video Player Client State Lifecycle](#32-video-player-client-state-lifecycle)
- [4. Class & Component Relationship Diagram](#4-class--component-relationship-diagram)
- [5. Package & Module Dependency Diagram](#5-package--module-dependency-diagram)
- [6. Gap Analysis & Recommendations](#6-gap-analysis--recommendations)
- [7. Cross References](#7-cross-references)

---

## 1. End-to-End Data Lifecycle

Data in StreamVault traverses four distinct lifecycles:
1. **Catalog & Metadata**: Ingested via Admin routes, indexed in PostgreSQL, cached in Redis with TTLs (120s–300s), and rendered to clients via Next.js SSR.
2. **Media Stream Segments**: Uploaded as master files, verified via SHA-256, encoded into multi-codec elementary streams, fragmented into 4-second `.m4s` chunks, packaged with DASH/HLS manifests, and served through NGINX byte-range caching.
3. **Session & Security State**: Stateless JWTs issued to HttpOnly cookies, refresh tokens hashed with SHA-256 and stored in the database, with rate limit sliding counters tracked in Redis sorted sets.
4. **Observability & QoE Telemetry**: Emitted asynchronously from client browsers via `navigator.sendBeacon`, validated against sliding rate limits, persisted in `playback_telemetry`, and aggregated into `/api/metrics` Prometheus counters.

---

## 2. System Interaction Sequence Diagrams

### 2.1 Authentication & Token Rotation Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant API as Next.js Auth API (/api/auth)
    participant Limiter as Redis Rate Limiter
    participant DB as PostgreSQL Database
    participant JWT as jose Crypto Engine

    User->>API: POST /api/auth/login { email, password }
    API->>Limiter: Check auth rate limit (15 / 15min per IP)
    Limiter-->>API: Rate limit OK
    
    API->>DB: Query users WHERE email = :email
    DB-->>API: Return user record with password_hash
    API->>API: bcrypt.compare(password, password_hash)
    
    API->>JWT: Sign 15-minute Access Token (HS256/RS256)
    JWT-->>API: Return access_token
    
    API->>API: Generate 64-byte random hex string (refresh_token)
    API->>API: Compute SHA-256 hash of refresh_token
    API->>DB: INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    
    API-->>User: Set-Cookie: access_token (HttpOnly, Lax, 15m)<br/>Set-Cookie: refresh_token (HttpOnly, Strict, 30d)<br/>200 OK { user, profiles }
    
    Note over User, API: When Access Token Expires (15 mins later)
    User->>API: GET /api/auth/me (access_token expired)
    API->>DB: Verify refresh_token hash & check revoked_at IS NULL
    DB-->>API: Valid refresh token record
    API->>JWT: Mint fresh 15-minute access_token
    API-->>User: Set-Cookie: access_token (fresh 15m)<br/>200 OK { user, profiles }
```

---

### 2.2 Ingestion & Asynchronous Transcoding Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin Operator
    participant NGINX as NGINX Reverse Proxy
    participant FastAPI as FastAPI Media API
    participant Worker as Transcoding Engine
    participant Packager as Shaka Packager
    participant DB as PostgreSQL DB
    participant Disk as Local Storage (/stream_assets)

    Admin->>NGINX: POST /api/v1/admin/upload (Master Video File)
    NGINX->>FastAPI: Pass multipart payload (max 10GB)
    FastAPI->>Disk: Write raw file to uploads/sources/
    FastAPI->>DB: INSERT INTO encoding_jobs (status='pending', progress=0)
    DB-->>FastAPI: Return job_id
    FastAPI-->>Admin: 200 OK { job_id, status: 'pending' }

    FastAPI->>Worker: Trigger process_encoding_job(job_id) in background
    Worker->>DB: UPDATE encoding_jobs SET status='processing', progress=10
    
    Worker->>Worker: Compute SHA-256 & verify streams via ffprobe
    Worker->>DB: UPDATE encoding_jobs SET progress=25
    
    Worker->>Worker: Detect scene cut points (FFmpeg gt(scene, 0.4))
    Worker->>Worker: Encode SVT-AV1 ladder (1080p, 720p, 480p, 360p)
    Worker->>Worker: Encode libx264 ladder (1080p, 720p, 480p)
    Worker->>DB: UPDATE encoding_jobs SET progress=70
    
    Worker->>Worker: Compute VMAF 93+ scores via libvmaf
    Worker->>Worker: Generate thumbnail sprites & 6s preview clip
    
    Worker->>Packager: Package elementary streams into DASH & HLS
    Packager->>Disk: Write manifest.mpd, master.m3u8, and .m4s fragments
    
    Worker->>DB: UPDATE encoding_jobs SET status='completed', progress=100, vmaf_scores=:vmaf
    Worker->>DB: UPDATE content SET video_key=dash_path, hls_manifest_key=hls_path
```

---

### 2.3 Adaptive Playback & Manifest Negotiation Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client as Player Client (Shaka Player)
    participant NGINX as NGINX Edge Proxy
    participant Disk as Static Media Storage
    participant Telemetry as Analytics API (/api/analytics/playback)

    Client->>NGINX: GET /stream_assets/1/manifest.mpd
    NGINX->>Disk: Fetch DASH manifest
    NGINX-->>Client: 200 OK (Content-Type: application/dash+xml)
    
    Client->>Client: Parse AdaptationSets (SVT-AV1, H.264, AAC Audio, Subtitles)
    Client->>Client: Default bandwidth estimate = 3.5 Mbps
    
    Client->>NGINX: GET /stream_assets/1/v_1080p.mp4 (init segment)
    NGINX-->>Client: 200 OK (Initialization segment)
    Client->>NGINX: GET /stream_assets/1/a_0_und_0.mp4 (audio init)
    NGINX-->>Client: 200 OK (Audio initialization)

    Client->>Client: Render first frame -> Emit "startup" event
    Client->>Telemetry: POST /api/analytics/playback { eventType: 'startup', startupLatencyMs: 380 }

    loop Continuous Playback (4s chunks)
        Client->>NGINX: GET /stream_assets/1/v_1080p_0001.m4s
        NGINX-->>Client: 200 OK (Media segment)
        Client->>Client: Measure download throughput
        alt Network bandwidth drops below 1.5 Mbps
            Client->>Client: ABR triggers switch to 480p
            Client->>Client: Shrink buffer goal from 35s to 20s
            Client->>Telemetry: POST /api/analytics/playback { eventType: 'bitrate_change', currentBitrateBps: 850000 }
        else Network bandwidth exceeds 6.0 Mbps
            Client->>Client: ABR triggers switch to 1080p
            Client->>Client: Expand buffer goal to 60s
        end
    end
```

---

### 2.4 Interactive Content Marker ("Skip Intro") Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Viewer
    participant Player as VideoPlayer Component
    participant Video as HTML5 Video Element
    participant Toast as Toast Notification Engine

    Player->>Player: Read props: introStartTime=24.5, introEndTime=89.0
    Video->>Player: timeupdate event (currentTime = 25.0)
    Player->>Player: Condition met: currentTime >= 24.5 && currentTime < 89.0
    Player->>User: Render animated floating "Skip Intro" button (Framer Motion)

    User->>Player: Click "Skip Intro"
    Player->>Video: Set video.currentTime = 89.0
    Player->>Toast: toast.success("Intro skipped")
    Player->>User: Hide "Skip Intro" button immediately
```

---

### 2.5 Real-Time QoE Telemetry Ingestion Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client as Shaka Player Client
    participant TelemetryAPI as Telemetry API (/api/analytics/playback)
    participant Limiter as Redis Rate Limiter
    participant DB as PostgreSQL Database
    participant Prometheus as Metrics Exporter (/api/metrics)

    Note over Client: Video stalls due to network drop
    Client->>Client: Capture buffering start timestamp
    Client->>Client: Buffer recovers -> bufferDurationMs = 1240ms
    Client->>TelemetryAPI: navigator.sendBeacon(POST { eventType: 'buffering', bufferDurationMs: 1240 })
    
    TelemetryAPI->>Limiter: Check telemetry sliding window (180/min per IP)
    Limiter-->>TelemetryAPI: Request permitted
    
    TelemetryAPI->>DB: INSERT INTO playback_telemetry (session_id, event_type, buffer_duration_ms, ...)
    DB-->>TelemetryAPI: Success
    TelemetryAPI-->>Client: 200 OK { success: true, ingested: 1 }

    Note over Prometheus: Prometheus Scraper Polls StreamVault
    Prometheus->>DB: SELECT count(*) FROM playback_telemetry WHERE created_at > NOW() - INTERVAL '1 hour'
    Prometheus-->>Prometheus: Expose streamvault_playback_telemetry_events_total counter
```

---

## 3. System State Machines

### 3.1 Encoding Job State Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending: Video Upload Completed (/api/v1/admin/upload)
    
    pending --> processing: Worker picks up job (process_encoding_job)
    
    state processing {
        [*] --> Probing: ffprobe container
        Probing --> SceneDetection: gt(scene, 0.4)
        SceneDetection --> EncodingAV1: SVT-AV1 ladder
        EncodingAV1 --> EncodingH264: libx264 fallback
        EncodingH264 --> VMAFScoring: libvmaf perceptual check
        VMAFScoring --> Packaging: Shaka Packager DASH/HLS
        Packaging --> [*]
    }
    
    processing --> completed: Manifests created & database content linked
    processing --> failed: Execution error / Corrupted source / Invalid container
    
    failed --> pending: Admin triggers retry (/api/v1/admin/jobs/{id}/retry)
    completed --> [*]
```

### 3.2 Video Player Client State Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Uninitialized: Component Mount
    Uninitialized --> Loading: player.load(manifestUrl)
    
    Loading --> Buffering: Waiting for initial segments
    Buffering --> Playing: First frame rendered (Emit startup event)
    
    Playing --> Buffering: Buffer underrun (waiting event)
    Buffering --> Playing: Buffer replenished (playing event)
    
    Playing --> Paused: User pause / window blur
    Paused --> Playing: User play
    
    Playing --> Seeking: User seeks / Skip Intro clicked
    Seeking --> Buffering: Wait for target keyframe
    
    Playing --> Ended: currentTime >= duration
    Ended --> [*]
```

---

## 4. Class & Component Relationship Diagram

```mermaid
classDiagram
    class VideoPlayer {
        +string src
        +string title
        +number startTime
        +number introStartTime
        +number introEndTime
        +number creditsStartTime
        +handleQualityChange(string q)
        +togglePlay()
        +handleSkip(number seconds)
        +sendTelemetry(string eventType)
    }

    class MediaPipeline {
        +Path work_dir
        +probe(string source_path)
        +verify_video_integrity(string source_path)
        +detect_scenes(string source_path)
        +encode_video_ladder(string source_path)
        +calculate_vmaf(string ref, string dist)
        +package_dash_hls()
        +run(string source_path)
    }

    class VideoRendition {
        +string name
        +int width
        +int height
        +int bitrate
        +int crf
        +string preset
        +string codec
    }

    class RedisCache {
        +cachedQuery(string key, int ttl, function fn)
        +flushPattern(string pattern)
    }

    class RateLimiter {
        +rateLimit(string key, RateLimitConfig config)
    }

    MediaPipeline --> VideoRendition : Uses
    VideoPlayer --> RateLimiter : Telemetry throttled by
    VideoPlayer --> RedisCache : Catalog backed by
```

---

## 5. Package & Module Dependency Diagram

```mermaid
graph TD
    subgraph FrontendModule["Frontend Module (src/)"]
        PlayerComponent["src/components/player/video-player.tsx"]
        BrowseApp["src/app/browse/page.tsx"]
        AdminDashboard["src/app/admin/page.tsx"]
        LibAuth["src/lib/auth.ts"]
        LibCache["src/lib/cache.ts"]
        LibRateLimit["src/lib/rate-limit.ts"]
        DrizzleSchema["src/db/schema.ts"]
    end

    subgraph MediaServerModule["Media Processing Module (media_server/)"]
        FastAPIMain["media_server/app/main.py"]
        WorkerPy["media_server/app/worker.py"]
        TranscoderPy["media_server/pipeline/transcoder.py"]
        ConfigPy["media_server/pipeline/config.py"]
        SQLAlchemyModels["media_server/app/models.py"]
    end

    BrowseApp --> LibCache
    BrowseApp --> LibAuth
    BrowseApp --> PlayerComponent
    PlayerComponent --> LibRateLimit
    AdminDashboard --> FastAPIMain

    FastAPIMain --> WorkerPy
    WorkerPy --> TranscoderPy
    TranscoderPy --> ConfigPy
    WorkerPy --> SQLAlchemyModels
    FastAPIMain --> SQLAlchemyModels

    LibCache --> DrizzleSchema
    LibAuth --> DrizzleSchema
```

---

## 6. Gap Analysis & Recommendations

| Interaction Flow | Current Implementation | Production Recommendation |
| :--- | :--- | :--- |
| **Transcode Dispatch** | FastAPI `BackgroundTasks` executing within the web process | Distributed Celery / Redis queue worker pool with task persistence |
| **Telemetry Ingest** | Synchronous relational row insert on each beacon | Fire-and-forget ingestion to Kafka topic with micro-batched persistence |
| **Quality Switching** | Track selection via Shaka API | Predictive ABR combining player buffer depth and device compute metrics |
| **Resume Playback** | Debounced POST to `/api/watch/progress` | WebSocket or Server-Sent Events (SSE) state synchronization across multiple screens |

---

## 7. Cross References

- [Master Documentation Hub](file:///d:/clg/Projects/Netflix/docs/README.md)
- [System Architecture](file:///d:/clg/Projects/Netflix/docs/system_architecture.md)
- [Video Transcoding Pipeline](file:///d:/clg/Projects/Netflix/docs/video_streaming_pipeline.md)
- [Playback & Player Engine](file:///d:/clg/Projects/Netflix/docs/playback_engine.md)
- [Database Architecture & Schema](file:///d:/clg/Projects/Netflix/docs/database_design_and_schema.md)
- [REST API Reference](file:///d:/clg/Projects/Netflix/docs/api_reference.md)
