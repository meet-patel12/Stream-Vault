import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  real,
  jsonb,
  bigint,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const contentTypeEnum = pgEnum("content_type", ["movie", "series"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "basic",
  "standard",
  "premium",
]);
export const encodingJobStatusEnum = pgEnum("encoding_job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("user"),
    plan: subscriptionPlanEnum("plan").notNull().default("basic"),
    emailVerified: boolean("email_verified").notNull().default(false),
    resetToken: varchar("reset_token", { length: 255 }),
    resetTokenExpiry: timestamp("reset_token_expiry"),
    twoFactorSecret: varchar("two_factor_secret", { length: 255 }),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    twoFactorBackupCodes: text("two_factor_backup_codes"),
    refreshTokenVersion: integer("refresh_token_version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

// ─── Profiles ─────────────────────────────────────────────────────────────────
export const profiles = pgTable(
  "profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    avatarColor: varchar("avatar_color", { length: 20 })
      .notNull()
      .default("#E50914"),
    avatarEmoji: varchar("avatar_emoji", { length: 10 }).notNull().default("🎬"),
    isKids: boolean("is_kids").notNull().default(false),
    pinHash: varchar("pin_hash", { length: 255 }),
    isLocked: boolean("is_locked").notNull().default(false),
    preferredLanguage: varchar("preferred_language", { length: 20 }).notNull().default("en"),
    preferredAudio: varchar("preferred_audio", { length: 20 }).notNull().default("original"),
    preferredSubtitle: varchar("preferred_subtitle", { length: 20 }).notNull().default("off"),
    autoplayPreviews: boolean("autoplay_previews").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("profiles_user_id_idx").on(t.userId)]
);

// ─── Refresh Tokens ───────────────────────────────────────────────────────────
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [index("refresh_tokens_user_id_idx").on(t.userId)]
);

// ─── Genres ───────────────────────────────────────────────────────────────────
export const genres = pgTable("genres", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
});

// ─── Content ──────────────────────────────────────────────────────────────────
export const content = pgTable(
  "content",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    type: contentTypeEnum("type").notNull().default("movie"),
    releaseYear: integer("release_year"),
    maturityRating: varchar("maturity_rating", { length: 10 }).default("PG-13"),
    duration: integer("duration"), // minutes for movies
    backdropUrl: text("backdrop_url"),
    posterUrl: text("poster_url"),
    trailerUrl: text("trailer_url"),
    videoKey: text("video_key"), // S3/CDN key for the main video
    hlsManifestKey: text("hls_manifest_key"), // HLS .m3u8 key
    isFeatured: boolean("is_featured").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(true),
    cast: jsonb("cast").$type<string[]>().default([]),
    directors: jsonb("directors").$type<string[]>().default([]),
    tags: jsonb("tags").$type<string[]>().default([]),
    imdbRating: real("imdb_rating"),
    totalSeasons: integer("total_seasons"), // for series
    introStartTime: real("intro_start_time"), // seconds
    introEndTime: real("intro_end_time"), // seconds
    creditsStartTime: real("credits_start_time"), // seconds
    chapters: jsonb("chapters").$type<Array<{ title: string; startTime: number }>>().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("content_type_idx").on(t.type),
    index("content_featured_idx").on(t.isFeatured),
    index("content_slug_idx").on(t.slug),
  ]
);

// ─── Content Genres (join table) ──────────────────────────────────────────────
export const contentGenres = pgTable(
  "content_genres",
  {
    contentId: integer("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    genreId: integer("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("content_genres_content_idx").on(t.contentId),
    index("content_genres_genre_idx").on(t.genreId),
  ]
);

// ─── Episodes (for series) ────────────────────────────────────────────────────
export const episodes = pgTable(
  "episodes",
  {
    id: serial("id").primaryKey(),
    contentId: integer("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    seasonNumber: integer("season_number").notNull().default(1),
    episodeNumber: integer("episode_number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    duration: integer("duration"), // minutes
    thumbnailUrl: text("thumbnail_url"),
    videoKey: text("video_key"),
    hlsManifestKey: text("hls_manifest_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("episodes_content_season_idx").on(t.contentId, t.seasonNumber)]
);

// ─── Watch History ────────────────────────────────────────────────────────────
export const watchHistory = pgTable(
  "watch_history",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    contentId: integer("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    episodeId: integer("episode_id").references(() => episodes.id, {
      onDelete: "cascade",
    }),
    progressSeconds: integer("progress_seconds").notNull().default(0),
    totalSeconds: integer("total_seconds"),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("watch_history_profile_idx").on(t.profileId),
    index("watch_history_content_idx").on(t.contentId),
  ]
);

// ─── My List ──────────────────────────────────────────────────────────────────
export const myList = pgTable(
  "my_list",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    contentId: integer("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("my_list_unique_idx").on(t.profileId, t.contentId),
    index("my_list_profile_idx").on(t.profileId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  profiles: many(profiles),
  refreshTokens: many(refreshTokens),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
  watchHistory: many(watchHistory),
  myList: many(myList),
}));

export const contentRelations = relations(content, ({ many }) => ({
  contentGenres: many(contentGenres),
  episodes: many(episodes),
  watchHistory: many(watchHistory),
  myList: many(myList),
}));

export const genresRelations = relations(genres, ({ many }) => ({
  contentGenres: many(contentGenres),
}));

export const contentGenresRelations = relations(contentGenres, ({ one }) => ({
  content: one(content, {
    fields: [contentGenres.contentId],
    references: [content.id],
  }),
  genre: one(genres, {
    fields: [contentGenres.genreId],
    references: [genres.id],
  }),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  content: one(content, {
    fields: [episodes.contentId],
    references: [content.id],
  }),
}));

export const watchHistoryRelations = relations(watchHistory, ({ one }) => ({
  profile: one(profiles, {
    fields: [watchHistory.profileId],
    references: [profiles.id],
  }),
  content: one(content, {
    fields: [watchHistory.contentId],
    references: [content.id],
  }),
  episode: one(episodes, {
    fields: [watchHistory.episodeId],
    references: [episodes.id],
  }),
}));

export const myListRelations = relations(myList, ({ one }) => ({
  profile: one(profiles, {
    fields: [myList.profileId],
    references: [profiles.id],
  }),
  content: one(content, {
    fields: [myList.contentId],
    references: [content.id],
  }),
}));

// ─── Encoding Jobs ────────────────────────────────────────────────────────────
export const encodingJobs = pgTable(
  "encoding_jobs",
  {
    id: serial("id").primaryKey(),
    contentId: integer("content_id").references(() => content.id, { onDelete: "set null" }),
    sourceFile: text("source_file").notNull(),
    status: encodingJobStatusEnum("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    dashManifest: text("dash_manifest"),
    hlsManifest: text("hls_manifest"),
    vmafScores: jsonb("vmaf_scores").$type<Record<string, number>>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("encoding_jobs_status_idx").on(t.status)]
);

export const encodingJobsRelations = relations(encodingJobs, ({ one }) => ({
  content: one(content, {
    fields: [encodingJobs.contentId],
    references: [content.id],
  }),
}));

// ─── Ratings ──────────────────────────────────────────────────────────────────
export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    contentId: integer("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ratings_profile_content_idx").on(t.profileId, t.contentId),
    index("ratings_content_idx").on(t.contentId),
  ]
);

// ─── Comments ─────────────────────────────────────────────────────────────────
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    contentId: integer("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("comments_content_idx").on(t.contentId)]
);

// ─── Playback Telemetry (QoE Tracking) ─────────────────────────────────────────
export const playbackTelemetry = pgTable(
  "playback_telemetry",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id", { length: 100 }).notNull(),
    profileId: integer("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    contentId: integer("content_id").references(() => content.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(), // startup, buffering, bitrate_change, seek, error, heartbeat
    currentTime: real("current_time").notNull().default(0),
    startupLatencyMs: integer("startup_latency_ms"),
    bufferDurationMs: integer("buffer_duration_ms"),
    currentBitrateBps: integer("current_bitrate_bps"),
    currentResolution: varchar("current_resolution", { length: 20 }),
    droppedFrames: integer("dropped_frames").default(0),
    playerEngine: varchar("player_engine", { length: 50 }).default("shaka"), // shaka, hls.js, native
    userAgent: text("user_agent"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("telemetry_session_idx").on(t.sessionId),
    index("telemetry_content_idx").on(t.contentId),
    index("telemetry_event_type_idx").on(t.eventType),
    index("telemetry_created_at_idx").on(t.createdAt),
  ]
);

// ─── Security Audit Logs ───────────────────────────────────────────────────────
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(), // e.g. CONTENT_CREATE, CONTENT_DELETE, USER_ROLE_CHANGE, JOB_RETRY, AUTH_LOGIN_FAIL
    targetType: varchar("target_type", { length: 50 }),   // content, user, job, system
    targetId: varchar("target_id", { length: 50 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_user_idx").on(t.userId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ]
);

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Content = typeof content.$inferSelect;
export type NewContent = typeof content.$inferInsert;
export type Genre = typeof genres.$inferSelect;
export type Episode = typeof episodes.$inferSelect;
export type WatchHistory = typeof watchHistory.$inferSelect;
export type MyListItem = typeof myList.$inferSelect;
export type EncodingJob = typeof encodingJobs.$inferSelect;
export type NewEncodingJob = typeof encodingJobs.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type NewRating = typeof ratings.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type PlaybackTelemetry = typeof playbackTelemetry.$inferSelect;
export type NewPlaybackTelemetry = typeof playbackTelemetry.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: varchar("plan", { length: 30 }).notNull().default("basic"),
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default("monthly"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    pricePaid: real("price_paid").notNull().default(0),
    taxAmount: real("tax_amount").notNull().default(0),
    currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    trialEndsAt: timestamp("trial_ends_at"),
    pausedAt: timestamp("paused_at"),
    canceledAt: timestamp("canceled_at"),
    gateway: varchar("gateway", { length: 30 }).notNull().default("stripe"),
    gatewaySubscriptionId: text("gateway_subscription_id"),
    gatewayCustomerId: text("gateway_customer_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_user_idx").on(t.userId),
    index("subscriptions_status_idx").on(t.status),
  ]
);

// ─── Coupons ──────────────────────────────────────────────────────────────────
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountPercent: integer("discount_percent").default(0),
  discountAmount: real("discount_amount").default(0),
  currency: varchar("currency", { length: 10 }).default("USD"),
  validUntil: timestamp("valid_until"),
  maxUses: integer("max_uses").default(1000),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: integer("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
    amount: real("amount").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    gstRate: real("gst_rate").notNull().default(18.0),
    gstAmount: real("gst_amount").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("paid"),
    paymentMethod: varchar("payment_method", { length: 50 }),
    paymentGateway: varchar("payment_gateway", { length: 30 }),
    transactionId: varchar("transaction_id", { length: 100 }),
    billingAddress: jsonb("billing_address").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("invoices_user_idx").on(t.userId),
    index("invoices_created_at_idx").on(t.createdAt),
  ]
);

// ─── Payment Transactions ─────────────────────────────────────────────────────
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    gateway: varchar("gateway", { length: 30 }).notNull(),
    gatewayTransactionId: varchar("gateway_transaction_id", { length: 255 }),
    gatewayPaymentMethod: varchar("gateway_payment_method", { length: 50 }),
    failureReason: text("failure_reason"),
    refundAmount: real("refund_amount").default(0),
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("payment_tx_user_idx").on(t.userId),
    index("payment_tx_gateway_idx").on(t.gateway),
    index("payment_tx_status_idx").on(t.status),
  ]
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;

// ─── Playlists & Collections (Phase 10) ───────────────────────────────────────
export const playlists = pgTable(
  "playlists",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 50 }).notNull().default("custom"), // custom, favorites, watch_later, collection
    isPublic: boolean("is_public").notNull().default(false),
    shareToken: varchar("share_token", { length: 100 }).unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("playlists_profile_idx").on(t.profileId),
    index("playlists_user_idx").on(t.userId),
    uniqueIndex("playlists_share_token_idx").on(t.shareToken),
  ]
);

export const playlistItems = pgTable(
  "playlist_items",
  {
    id: serial("id").primaryKey(),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    contentId: integer("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("playlist_items_unique_idx").on(t.playlistId, t.contentId),
    index("playlist_items_playlist_idx").on(t.playlistId),
  ]
);

// ─── Offline Downloads (Phase 11) ─────────────────────────────────────────────
export const offlineDownloads = pgTable(
  "offline_downloads",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    contentId: integer("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    episodeId: integer("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
    quality: varchar("quality", { length: 20 }).notNull().default("1080p"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull().default(0),
    storagePath: text("storage_path"),
    status: varchar("status", { length: 30 }).notNull().default("completed"),
    expiresAt: timestamp("expires_at"),
    downloadedAt: timestamp("downloaded_at").notNull().defaultNow(),
  },
  (t) => [
    index("offline_downloads_profile_idx").on(t.profileId),
    index("offline_downloads_user_idx").on(t.userId),
  ]
);

// ─── Notifications (Phase 12) ─────────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: integer("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    type: varchar("type", { length: 50 }).notNull().default("system"), // new_release, subscription, payment, continue_watching, recommendation, system
    actionUrl: varchar("action_url", { length: 500 }),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_created_idx").on(t.createdAt),
    index("notifications_unread_idx").on(t.userId, t.isRead),
  ]
);

// ─── User Devices & Security (Phase 14) ────────────────────────────────────────
export const userDevices = pgTable(
  "user_devices",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceName: varchar("device_name", { length: 255 }).notNull(),
    deviceType: varchar("device_type", { length: 50 }).notNull().default("desktop"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
    isCurrent: boolean("is_current").notNull().default(false),
    isRevoked: boolean("is_revoked").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("user_devices_user_idx").on(t.userId),
  ]
);

export const loginHistory = pgTable(
  "login_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ipAddress: varchar("ip_address", { length: 64 }),
    location: varchar("location", { length: 255 }),
    userAgent: text("user_agent"),
    status: varchar("status", { length: 30 }).notNull().default("success"),
    attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
  },
  (t) => [
    index("login_history_user_idx").on(t.userId),
    index("login_history_attempted_idx").on(t.attemptedAt),
  ]
);

export type Playlist = typeof playlists.$inferSelect;
export type PlaylistItem = typeof playlistItems.$inferSelect;
export type OfflineDownload = typeof offlineDownloads.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserDevice = typeof userDevices.$inferSelect;
export type LoginHistoryItem = typeof loginHistory.$inferSelect;




