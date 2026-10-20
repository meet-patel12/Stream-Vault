# 📡 StreamVault REST API Reference & Specification

| Metadata | Details |
| :--- | :--- |
| **Title** | Complete REST API Reference, Request/Response Specifications & OpenAPI Definition |
| **Document ID** | API-001 |
| **Version** | 2.0.0 (Production Multi-Codec Enterprise Edition) |
| **Author** | Principal API Architect & Systems Integration Lead |
| **Date** | 2026-09-29 |
| **Purpose** | Definitive API contract specification covering all endpoints, authentication headers, rate limits, request parameters, response bodies, and error structures. |
| **Scope** | All RESTful endpoints exposed by the Next.js API router (`src/app/api/`) and the FastAPI media service (`media_server/app/main.py`). |

---

## 📑 Table of Contents

- [1. API Conventions & Authentication Protocol](#1-api-conventions--authentication-protocol)
- [2. Authentication & Session APIs](#2-authentication--session-apis)
- [3. Profile & User Management APIs](#3-profile--user-management-apis)
- [4. Content Catalog & Discovery APIs](#4-content-catalog--discovery-apis)
- [5. AI Recommendations & Fuzzy Search APIs](#5-ai-recommendations--fuzzy-search-apis)
- [6. Streaming, Media & Signed URL APIs](#6-streaming-media--signed-url-apis)
- [7. User Engagement APIs (Watch, List, Ratings, Comments)](#7-user-engagement-apis-watch-list-ratings-comments)
- [8. QoE Telemetry & Observability APIs](#8-qoe-telemetry--observability-apis)
- [9. Admin & Transcoding Operations APIs](#9-admin--transcoding-operations-apis)
- [10. Rate Limiting Rules & Quotas](#10-rate-limiting-rules--quotas)
- [11. OpenAPI 3.0 Contract Specification](#11-openapi-30-contract-specification)
- [12. Cross References](#12-cross-references)

---

## 1. API Conventions & Authentication Protocol

- **Base URL**: `https://streamvault.example.com` (or `http://localhost:3000` in development).
- **Transport Security**: HTTPS required in production.
- **Authentication**: Cookie-based JWT tokens:
  - `access_token`: Short-lived (15 minutes), HttpOnly, SameSite=Lax.
  - `refresh_token`: Long-lived (30 days), HttpOnly, SameSite=Strict.
- **Envelope Standard**: All JSON responses use a standard envelope (`{ success: true, data: { ... } }`).

---

## 2. Authentication & Session APIs

### `POST /api/auth/register`
Creates a new user account, creates a default primary profile, and signs authentication cookies.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": 1, "email": "user@example.com", "role": "user", "plan": "basic" },
      "defaultProfile": { "id": 1, "name": "Primary", "avatarColor": "#E50914" }
    }
  }
  ```

### `POST /api/auth/login`
Authenticates credentials, returns profile lists, and sets cookies.
- **Rate Limit**: 15 requests per 15 minutes.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Response `200 OK`**: Returns user record and linked viewer profiles.

### `POST /api/auth/logout`
Revokes active refresh token in database (`revoked_at = NOW()`) and purges cookies.

### `GET /api/auth/me`
Validates active session and returns authenticated identity.

---

## 3. Profile & User Management APIs

### `GET /api/profiles`
Returns all profiles belonging to the authenticated account.

### `POST /api/profiles`
Creates an additional viewer profile (up to 5 per account).
- **Request Body**:
  ```json
  {
    "name": "Kids Profile",
    "avatarColor": "#0070F3",
    "avatarEmoji": "🚀",
    "isKids": true
  }
  ```

### `DELETE /api/profiles/[id]`
Deletes a profile and cascades deletion of its watch history and watchlist.

---

## 4. Content Catalog & Discovery APIs

### `GET /api/content`
Paginated catalog listing.
- **Query Parameters**:
  - `type` (optional): `"movie"` | `"series"`.
  - `genre` (optional): slug string (e.g. `"action"`).
  - `featured` (optional): `"true"` | `"false"`.
  - `limit` (default: 20, max: 50).
  - `offset` (default: 0).
- **Caching**: Cached in Redis for 180 seconds.

### `GET /api/content/featured`
Returns content marked as `is_featured = true` for display on the billboard.
- **Caching**: Cached in Redis for 300 seconds.

### `GET /api/content/[slug]`
Returns complete metadata for a title, including genre tags, cast list, and episodes (for series).

---

## 5. AI Recommendations & Fuzzy Search APIs

### `GET /api/content/search?q={query}`
Multi-tier ranked search engine with Levenshtein typo-forgiveness.
- **Rate Limit**: 45 requests per minute.
- **Caching**: Cached in Redis for 120 seconds.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "query": "stranger thngs",
      "total": 1,
      "items": [
        {
          "id": 14,
          "title": "Stranger Things",
          "slug": "stranger-things",
          "relevanceScore": 75
        }
      ]
    }
  }
  ```

### `GET /api/recommendations?profileId={id}&limit={n}`
Hybrid recommendation engine balancing collaborative signals and genre vectors.
- **Caching**: Cached in Redis for 600 seconds.

---

## 6. Streaming, Media & Signed URL APIs

### `GET /api/stream/media?file={path}&quality={qual}`
HTTP 206 Partial Content byte-range video streaming endpoint with on-the-fly FFmpeg scaling.
- **Headers Required**: `Range: bytes={start}-{end}`.
- **Headers Emitted**: `Content-Range: bytes {start}-{end}/{total}`, `Accept-Ranges: bytes`.

### `POST /api/stream/signed-url`
Generates expiring HMAC SHA-256 signed playback token for CDN or edge proxy delivery.
- **Request Body**: `{ "videoKey": "14/manifest.mpd" }`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "signedUrl": "https://stream.example.com/14/manifest.mpd?token=...&expires=1727503600",
      "expiresIn": 3600
    }
  }
  ```

### `GET /api/b2/[...path]`
Backblaze B2 reverse proxy routing requests through Cloudflare Worker edge nodes with automated token refreshing.

---

## 7. User Engagement APIs (Watch, List, Ratings, Comments)

### `POST /api/watch/progress`
Saves current playback position per profile.
- **Request Body**:
  ```json
  {
    "profileId": 1,
    "contentId": 42,
    "episodeId": null,
    "progressSeconds": 1420,
    "totalSeconds": 7200
  }
  ```

### `GET /api/watch/progress?profileId={id}`
Returns active "Continue Watching" list.

### `POST /api/my-list` & `DELETE /api/my-list/[id]`
Toggles items in the profile's personal watchlist.

### `POST /api/ratings`
Submits 1–5 star rating for content.

### `POST /api/comments`
Posts interactive discussion comment.

---

## 8. QoE Telemetry & Observability APIs

### `POST /api/analytics/playback`
High-throughput ingestion of client playback events via `navigator.sendBeacon`.
- **Rate Limit**: 180 requests per minute.
- **Payload**:
  ```json
  {
    "sessionId": "session_1727500000_abc123",
    "contentId": 42,
    "profileId": 1,
    "eventType": "startup",
    "startupLatencyMs": 380,
    "currentBitrateBps": 3200000,
    "currentResolution": "1080p",
    "playerEngine": "shaka"
  }
  ```

### `GET /api/metrics`
Standard Prometheus exposition endpoint (`text/plain; version=0.0.4`) exposing database pool counts, memory usage, encoding queue status, and active users.

---

## 9. Admin & Transcoding Operations APIs

Exposed on port 8000 via FastAPI (routed through NGINX at `/api/v1/admin/`):

### `POST /api/v1/admin/upload`
Uploads raw video master file and initiates asynchronous background transcoding.
- **Content-Type**: `multipart/form-data`.
- **Fields**: `file: UploadFile`, `content_id: Optional[int]`.
- **Response `200 OK`**: `{ "job_id": 4, "status": "pending", "message": "Upload successful, transcoding queued" }`.

### `GET /api/v1/admin/jobs`
Returns all encoding jobs, their statuses, progress percentages, and VMAF scores.

### `POST /api/v1/admin/jobs/{id}/retry`
Requeues a failed encoding job.

### `GET /api/v1/admin/stats`
Returns total jobs processed, completed, failed, and pending.

---

## 10. Rate Limiting Rules & Quotas

| Policy Tier | Window Size | Quota | Applied Endpoints |
| :--- | :--- | :--- | :--- |
| `auth` | 15 minutes | 15 requests | `/api/auth/login`, `/api/auth/register` |
| `api` | 1 minute | 120 requests | `/api/content`, `/api/profiles`, `/api/ratings` |
| `search` | 1 minute | 45 requests | `/api/content/search` |
| `progress` | 10 seconds | 30 requests | `/api/watch/progress` |
| `telemetry` | 1 minute | 180 requests | `/api/analytics/playback` |

---

## 11. OpenAPI 3.0 Contract Specification

```yaml
openapi: 3.0.3
info:
  title: StreamVault OTT Streaming API
  version: 2.0.0
  description: Enterprise video streaming, catalog, authentication, and transcoding platform.
paths:
  /api/auth/login:
    post:
      summary: User login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string, format: email }
                password: { type: string }
      responses:
        '200':
          description: Login successful
        '429':
          description: Rate limited
  /api/content/search:
    get:
      summary: Fuzzy typo-tolerant search
      parameters:
        - name: q
          in: query
          required: true
          schema: { type: string }
      responses:
        '200':
          description: Ranked search results
  /api/analytics/playback:
    post:
      summary: Ingest QoE telemetry events
      responses:
        '200':
          description: Events ingested
```

---

## 12. Cross References

- [Master Documentation Hub](file:///d:/clg/Projects/Netflix/docs/README.md)
- [System Architecture](file:///d:/clg/Projects/Netflix/docs/system_architecture.md)
- [Video Ingestion & Transcoding Pipeline](file:///d:/clg/Projects/Netflix/docs/video_streaming_pipeline.md)
- [Playback & Player Engine](file:///d:/clg/Projects/Netflix/docs/playback_engine.md)
- [Security Architecture & Audit](file:///d:/clg/Projects/Netflix/docs/security_architecture_and_audit.md)
