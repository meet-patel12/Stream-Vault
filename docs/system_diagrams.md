# 🗺️ StreamVault System Architecture Diagrams Catalog

| Metadata | Details |
| :--- | :--- |
| **Title** | Master Visual Architectural Models & Mermaid Diagram Reference |
| **Document ID** | DIAG-001 |
| **Version** | 2.0.0 (Production Multi-Codec Enterprise Edition) |
| **Author** | Principal Software Architect & Systems Modeler |
| **Date** | 2026-09-29 |
| **Purpose** | Centralized visual catalog containing all system topology diagrams, streaming pipelines, entity models, state machines, and sequence interactions in Mermaid format. |
| **Scope** | Complete StreamVault streaming platform. |

---

## 📑 Table of Contents

- [1. High-Level System Architecture Diagram](#1-high-level-system-architecture-diagram)
- [2. Media Ingestion & Dual-Codec Transcoding Pipeline](#2-media-ingestion--dual-codec-transcoding-pipeline)
- [3. Google Shaka Player Playback & Smart Buffering Flow](#3-google-shaka-player-playback--smart-buffering-flow)
- [4. Complete Entity-Relationship (ER) Model](#4-complete-entity-relationship-er-model)
- [5. Authentication & JWT Rotation Sequence](#5-authentication--jwt-rotation-sequence)
- [6. Real-Time QoE Telemetry Pipeline Sequence](#6-real-time-qoe-telemetry-pipeline-sequence)
- [7. Encoding Job Lifecycle State Machine](#7-encoding-job-lifecycle-state-machine)
- [8. Video Player Client State Machine](#8-video-player-client-state-machine)
- [9. Kubernetes Production Cluster Deployment Topology](#9-kubernetes-production-cluster-deployment-topology)
- [10. Cross References](#10-cross-references)

---

## 1. High-Level System Architecture Diagram

```mermaid
graph TB
    subgraph Clients["Client Tier (Browsers, Mobile, Smart TVs)"]
        UserBrowser["Web Client (Next.js 16 / React 19)"]
        AdminBrowser["Admin Console (/admin)"]
        VideoEngine["Google Shaka Player / Hls.js"]
    end

    subgraph Edge["Edge & Ingress Tier"]
        NGINX["NGINX Edge Proxy (Port 80/443)<br/>Byte-Range Caching, CORS, Gzip"]
    end

    subgraph AppTier["Application Services Tier"]
        NextServer["Next.js Server (Port 3000)<br/>App Router, SSR, REST APIs"]
        MediaServer["FastAPI Media Server (Port 8000)<br/>Uvicorn Ingestion & Admin API"]
    end

    subgraph Workers["Background Compute Tier"]
        TranscodeWorker["Media Transcoding Pipeline<br/>FFmpeg / SVT-AV1 / libvmaf / Shaka Packager"]
    end

    subgraph Storage["Data & Caching Tier"]
        Postgres[(PostgreSQL 16 Engine<br/>Drizzle ORM & SQLAlchemy 2.0)]
        Redis[(Redis 7 Cluster<br/>Cache-Aside & Sliding Rate Limits)]
        AssetStore[("Stream Assets Storage<br/>/public/stream_assets/")]
    end

    UserBrowser -->|HTTPS Requests| NGINX
    AdminBrowser -->|HTTPS Requests| NGINX
    VideoEngine -->|DASH / HLS Segment Requests| NGINX

    NGINX -->|Route: /api/v1/admin/| MediaServer
    NGINX -->|Route: /stream_assets/| AssetStore
    NGINX -->|Route: Default /| NextServer

    NextServer -->|Cache Check & Rate Limit| Redis
    NextServer -->|Metadata & User Queries| Postgres
    NextServer -->|Telemetry Ingestion| Postgres

    MediaServer -->|Upload Ingestion| AssetStore
    MediaServer -->|Background Task Trigger| TranscodeWorker
    MediaServer -->|Job State & Catalog Sync| Postgres

    TranscodeWorker -->|Probe, Encode & Package| AssetStore
    TranscodeWorker -->|Update Progress & VMAF| Postgres
```

---

## 2. Media Ingestion & Dual-Codec Transcoding Pipeline

```mermaid
graph TD
    Upload[Raw Video Upload] --> Verify[1. SHA-256 Hash & ffprobe Integrity Check]
    Verify --> Scene[2. FFmpeg Scene Detection gt(scene, 0.4)]
    
    Scene --> DemuxA[3a. Extract Audio Tracks to AAC]
    Scene --> DemuxS[3b. Demux Subtitles to WebVTT]
    Scene --> EncodeAV1[3c. SVT-AV1 Multi-Bitrate Ladder]
    Scene --> EncodeH264[3d. libx264 Fallback Ladder]
    
    EncodeAV1 --> VMAF[4. VMAF Perceptual Quality Check libvmaf]
    EncodeH264 --> VMAF
    
    Scene --> Assets[5. Generate Thumbnails & 6s Preview Clip]
    
    VMAF --> Packager[6. Google Shaka Packager 4s Segments]
    DemuxA --> Packager
    DemuxS --> Packager
    
    Packager --> MPD[MPEG-DASH: manifest.mpd]
    Packager --> M3U8[HLS: master.m3u8]
    
    MPD --> Storage[Public Stream Assets: /public/stream_assets/{id}/]
    M3U8 --> Storage
    Assets --> Storage
```

---

## 3. Google Shaka Player Playback & Smart Buffering Flow

```mermaid
graph LR
    Throughput[Measured Bandwidth] --> Check{Throughput Threshold}
    Check -->|< 1.5 Mbps| Low[Buffer Goal: 20s<br/>Rebuffering Goal: 2.0s<br/>Saves client RAM]
    Check -->|1.5 - 6.0 Mbps| Mid[Buffer Goal: 35s<br/>Rebuffering Goal: 2.5s<br/>Balanced Default]
    Check -->|> 6.0 Mbps| High[Buffer Goal: 60s<br/>Rebuffering Goal: 3.0s<br/>Impervious to Wi-Fi drops]
```

---

## 4. Complete Entity-Relationship (ER) Model

```mermaid
erDiagram
    users ||--o{ profiles : "has many"
    users ||--o{ refresh_tokens : "has many"
    users ||--o{ audit_logs : "records actions"
    
    profiles ||--o{ watch_history : "tracks"
    profiles ||--o{ my_list : "bookmarks"
    profiles ||--o{ ratings : "submits"
    profiles ||--o{ comments : "posts"
    profiles ||--o{ playback_telemetry : "generates"
    
    content ||--o{ content_genres : "categorized by"
    genres ||--o{ content_genres : "applies to"
    content ||--o{ episodes : "contains"
    content ||--o{ watch_history : "viewed in"
    content ||--o{ my_list : "saved in"
    content ||--o{ ratings : "rated in"
    content ||--o{ comments : "discussed in"
    content ||--o{ playback_telemetry : "streamed in"
    content ||--o| encoding_jobs : "processed by"

    users {
        int id PK
        varchar email UK
        varchar password_hash
        user_role role
        subscription_plan plan
        boolean email_verified
        timestamp created_at
    }

    profiles {
        int id PK
        int user_id FK
        varchar name
        varchar avatar_color
        varchar avatar_emoji
        boolean is_kids
    }

    content {
        int id PK
        varchar title
        varchar slug UK
        content_type type
        text video_key
        text hls_manifest_key
        boolean is_featured
        boolean is_published
        real intro_start_time
        real intro_end_time
        real credits_start_time
    }

    encoding_jobs {
        int id PK
        int content_id FK
        text source_file
        varchar status
        int progress
        text dash_manifest
        text hls_manifest
        jsonb vmaf_scores
    }

    playback_telemetry {
        int id PK
        varchar session_id
        int profile_id FK
        int content_id FK
        varchar event_type
        real current_time
        int startup_latency_ms
        int buffer_duration_ms
        int current_bitrate_bps
    }
```

---

## 5. Authentication & JWT Rotation Sequence

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

## 6. Real-Time QoE Telemetry Pipeline Sequence

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

## 7. Encoding Job Lifecycle State Machine

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

---

## 8. Video Player Client State Machine

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

## 9. Kubernetes Production Cluster Deployment Topology

```mermaid
graph TB
    Internet((Public Internet)) --> Ingress[NGINX Ingress Controller<br/>Port 80/443 SSL]
    
    subgraph K8sCluster["Kubernetes Cluster (Namespace: streamvault)"]
        Ingress --> ServiceWeb[Service: streamvault-client-admin<br/>Port 3000]
        Ingress --> ServiceMedia[Service: streamvault-media-server<br/>Port 8000]
        
        ServiceWeb --> PodWeb1[Pod: Client-Admin 1]
        ServiceWeb --> PodWeb2[Pod: Client-Admin 2]
        ServiceWeb --> PodWebN[Pod: Client-Admin N (HPA 2-10)]
        
        ServiceMedia --> PodMedia1[Pod: Media Server 1]
    end

    PodWeb1 --> RedisService[(Redis Service)]
    PodWeb1 --> DBService[(PostgreSQL Service)]
```

---

## 10. Cross References

- [Master Documentation Hub](file:///d:/clg/Projects/Netflix/docs/README.md)
- [System Architecture](file:///d:/clg/Projects/Netflix/docs/system_architecture.md)
- [Data Flows & Sequence Diagrams](file:///d:/clg/Projects/Netflix/docs/data_flows_and_sequences.md)
- [Video Ingestion & Transcoding Pipeline](file:///d:/clg/Projects/Netflix/docs/video_streaming_pipeline.md)
- [Database Architecture & Schema](file:///d:/clg/Projects/Netflix/docs/database_design_and_schema.md)
