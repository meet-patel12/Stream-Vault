# 🗄️ Database Architecture & Schema Reference (`DATABASE.md`)
**Database Engine:** PostgreSQL 16 Alpine / Neon DB Serverless  
**ORM Layers:** Drizzle ORM (`src/db/schema.ts`) & Native PostgreSQL Client (`pg`)

---

## 📐 Complete Entity Relationship Architecture

```
                    ┌─────────────────────────┐
                    │          users          │
                    └────────────┬────────────┘
                                 │ 1:N
        ┌─────────────┬──────────┴──────────┬─────────────┬─────────────┐
        ▼             ▼                     ▼             ▼             ▼
┌───────────┐ ┌───────────────┐     ┌───────────────┐ ┌─────────┐ ┌─────────────┐
│ profiles  │ │ subscriptions │     │ user_devices  │ │invoices │ │login_history│
└─────┬─────┘ └───────┬───────┘     └───────────────┘ └─────────┘ └─────────────┘
      │ 1:N           │ 1:N
      │               ▼
      │       ┌──────────────────────┐
      │       │ payment_transactions │
      │       └──────────────────────┘
      │
      ├──────────────────────┬──────────────────────┬─────────────────┐
      ▼                      ▼                      ▼                 ▼
┌───────────┐          ┌───────────┐          ┌───────────┐     ┌───────────┐
│  my_list  │          │ playlists │          │ downloads │     │  ratings  │
└─────┬─────┘          └─────┬─────┘          └─────┬─────┘     └─────┬─────┘
      │                      │ 1:N                  │                 │
      │                      ▼                      │                 │
      │               ┌───────────────┐             │                 │
      │               │ playlist_items│             │                 │
      │               └───────┬───────┘             │                 │
      │                       │                     │                 │
      └───────────────────────┼─────────────────────┴─────────────────┘
                              │ N:1
                              ▼
                      ┌───────────────┐
                      │    content    │◄──────────┐
                      └───────┬───────┘           │ 1:1
                              │ 1:N               │
                      ┌───────┴───────┐   ┌───────┴───────┐
                      │ content_genres│   │ encoding_jobs │
                      └───────┬───────┘   └───────────────┘
                              │ N:1
                              ▼
                      ┌───────────────┐
                      │    genres     │
                      └───────────────┘

┌────────────────────────┐      ┌────────────────────────┐      ┌───────────────┐
│   playback_telemetry   │      │       audit_logs       │      │ notifications │
└────────────────────────┘      └────────────────────────┘      └───────────────┘
```

---

## 📋 Comprehensive Schema Reference

### 1. `users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `serial` | Primary Key | User unique identifier |
| `email` | `varchar(255)` | NOT NULL, Unique, Indexed | User login email |
| `password_hash` | `varchar(255)` | NOT NULL | bcrypt password hash |
| `role` | `user_role` enum | NOT NULL, Default `'user'` | `'admin'` or `'user'` |
| `plan` | `subscription_plan` enum | NOT NULL, Default `'basic'` | `'basic'`, `'standard'`, `'premium'` |
| `two_factor_secret` | `varchar(255)` | Nullable | Base32 TOTP secret |
| `two_factor_enabled` | `boolean` | NOT NULL, Default `false` | Status of 2FA |
| `two_factor_backup_codes` | `text` | Nullable | JSON array of 8 recovery codes |
| `refresh_token_version` | `integer` | NOT NULL, Default `1` | Token rotation version for instant global sign-out |
| `created_at` | `timestamp` | NOT NULL, Default `NOW()` | Account creation timestamp |

### 2. `profiles`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `serial` | Primary Key | Profile unique identifier |
| `user_id` | `integer` | NOT NULL, Foreign Key (`users.id` CASCADE) | Parent account |
| `name` | `varchar(100)` | NOT NULL | Profile display name |
| `avatar_color` | `varchar(20)` | NOT NULL, Default `'#E50914'` | Hex color code |
| `avatar_emoji` | `varchar(10)` | NOT NULL, Default `'🎬'` | Profile emoji avatar |
| `is_kids` | `boolean` | NOT NULL, Default `false` | Kids content filter restriction |
| `pin_hash` | `varchar(255)` | Nullable | bcrypt hash of 4-digit profile PIN |
| `is_locked` | `boolean` | NOT NULL, Default `false` | PIN protection lock flag |
| `preferred_language` | `varchar(20)` | Default `'en'` | UI language preference |
| `preferred_audio` | `varchar(20)` | Default `'original'` | Default audio track |
| `preferred_subtitle` | `varchar(20)` | Default `'off'` | Subtitle mode |
| `autoplay_previews` | `boolean` | Default `true` | Auto-play video preview cards |

### 3. `subscriptions`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `serial` | Primary Key | Subscription ID |
| `user_id` | `integer` | NOT NULL, Foreign Key (`users.id` CASCADE) | Account owner |
| `plan` | `varchar(30)` | NOT NULL, Default `'basic'` | `free`, `basic`, `standard`, `premium`, `family` |
| `billing_cycle` | `varchar(20)` | NOT NULL, Default `'monthly'` | `monthly`, `quarterly`, `annual` |
| `status` | `varchar(20)` | NOT NULL, Default `'active'` | `active`, `paused`, `canceled` |
| `currency` | `varchar(10)` | NOT NULL, Default `'USD'` | `USD`, `EUR`, `GBP`, `INR` |
| `price_paid` | `real` | NOT NULL | Base charge |
| `tax_amount` | `real` | NOT NULL, Default `0.0` | Itemized 18% GST |
| `payment_gateway` | `varchar(30)` | Nullable | `stripe`, `razorpay`, `paypal`, `apple_pay`, `google_pay` |

### 4. `invoices` & `payment_transactions`
- `invoices`: Tracks billing history, GST tax breakdowns, invoice PDFs, and payment statuses.
- `payment_transactions`: Immutable log of gateway transaction IDs, webhook receipts, failure reasons, and refund disbursements.

### 5. `playlists` & `playlist_items`
- `playlists`: Supports Favorites, Watch Later, Thematic Collections, and Custom User Playlists with unique public `share_token` capabilities.
- `playlist_items`: Ordered content items within playlists (`position` index).

### 6. `offline_downloads`
- Tracks offline video cache metadata, storage byte sizes, selected resolution (720p/1080p/4K), and 30-day expiration timestamps.

### 7. `notifications`
- Dispatches in-app notifications for new 4K releases, subscription renewals, continue watching reminders, and payment receipts with read receipts.

### 8. `user_devices` & `login_history`
- Device fingerprinting and session management with instant remote revocation.
- Security audit logs recording IP, user-agent, geolocation, and authorization status.

---

## ⚡ High-Throughput Database Indexes

All indexes are verified and operational in production:
```sql
CREATE INDEX idx_content_published_type ON content (is_published, type);
CREATE INDEX idx_content_published_rating ON content (is_published, imdb_rating DESC);
CREATE INDEX idx_content_slug ON content (slug);
CREATE INDEX idx_watch_history_profile_completed ON watch_history (profile_id, completed, updated_at DESC);
CREATE INDEX idx_ratings_profile_score ON ratings (profile_id, score DESC);
CREATE INDEX idx_subscriptions_user_status ON subscriptions (user_id, status);
CREATE INDEX idx_payment_tx_user_created ON payment_transactions (user_id, created_at DESC);
CREATE INDEX idx_telemetry_created ON playback_telemetry (created_at DESC);
```
