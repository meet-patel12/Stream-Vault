# 🖼️ StreamVault Media Assets & Storyboard Guidelines

| Metadata | Details |
| :--- | :--- |
| **Title** | Media Asset Specification, Directory Hierarchy & Artwork Guidelines |
| **Document ID** | AST-001 |
| **Version** | 2.0.0 (Production Multi-Codec Enterprise Edition) |
| **Author** | Lead Media Designer & Video Operations Engineer |
| **Date** | 2026-09-29 |
| **Purpose** | Authoritative guidelines for promotional posters, cinematic billboard art, thumbnail sprite sheets, and preview video clips. |
| **Scope** | Platform public media directories (`public/stream_assets/`, `public/images/`, `public/videos/`). |

---

## 📑 Table of Contents

- [1. Asset Directory Organization](#1-asset-directory-organization)
- [2. Promotional Artwork Specifications](#2-promotional-artwork-specifications)
- [3. Storyboard Thumbnail Sprite Sheets](#3-storyboard-thumbnail-sprite-sheets)
- [4. Dynamic 6-Second Preview Clips](#4-dynamic-6-second-preview-clips)
- [5. Encoding & Compression Standards](#5-encoding--compression-standards)
- [6. Cross References](#6-cross-references)

---

## 1. Asset Directory Organization

```
public/
├── stream_assets/               # Transcoded streaming packages
│   └── {job_id}/
│       ├── manifest.mpd         # Master MPEG-DASH manifest
│       ├── master.m3u8          # Master HLS multivariant playlist
│       ├── preview.mp4          # 6-second promotional hover preview clip
│       ├── thumb_%04d.jpg       # Periodic storyboard scrub thumbnails
│       ├── v_*.m4s              # Segmented video chunks
│       └── a_*.m4s              # Segmented audio chunks
├── images/                      # Static catalog posters and backdrops
└── videos/                      # Demo and raw promotional sources
```

---

## 2. Promotional Artwork Specifications

| Asset Type | Aspect Ratio | Target Dimensions | Accepted Formats | Max File Size | Purpose |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **Cinematic Backdrop** | $16:9$ | $1920 \times 1080$ | WebP, JPEG | 350 KB | Browse billboard hero background. |
| **Vertical Poster** | $2:3$ | $600 \times 900$ | WebP, JPEG | 180 KB | Carousel and search card poster. |
| **Episode Thumbnail** | $16:9$ | $640 \times 360$ | WebP, JPEG | 80 KB | Series episode selector list. |
| **Title Logo (PNG)** | Variable | Max $800 \times 300$ | PNG (Transparent) | 120 KB | Transparent overlay logo on billboard. |

---

## 3. Storyboard Thumbnail Sprite Sheets

- **Extraction Interval**: Every 5 seconds (`fps=1/5`).
- **Tile Dimensions**: $320 \times 180$ pixels ($16:9$).
- **Naming Pattern**: `thumb_%04d.jpg` (`thumb_0001.jpg`, `thumb_0002.jpg`, etc.).
- **Player Integration**: The seekbar listener calculates:
  $$\text{Index} = \left\lfloor \frac{\text{hoverTimestamp}}{5} \right\rfloor + 1$$
  and renders the corresponding image as a floating preview tooltip.

---

## 4. Dynamic 6-Second Preview Clips

- **File Name**: `preview.mp4`.
- **Duration**: Exactly 6.0 seconds cut between second 10 and 16 (`-ss 00:00:10 -t 6`).
- **Resolution**: $640 \times 360$ ($360\text{p}$).
- **Codec**: SVT-AV1 (`libsvtav1`, CRF 32, no audio tracks).
- **Behavior**: Auto-plays muted in a loop when viewers hover over content cards.

---

## 5. Encoding & Compression Standards

1. **Lossy Compression**: WebP with quality 82 is preferred over legacy JPEG, reducing image payloads by ~30%.
2. **CDN Caching**: Static images and stream assets emit `Cache-Control: public, max-age=31536000, immutable` via NGINX.

---

## 6. Cross References

- [Master Documentation Hub](file:///d:/clg/Projects/Netflix/docs/README.md)
- [Video Ingestion & Transcoding Pipeline](file:///d:/clg/Projects/Netflix/docs/video_streaming_pipeline.md)
- [Frontend Architecture](file:///d:/clg/Projects/Netflix/docs/frontend_architecture.md)
