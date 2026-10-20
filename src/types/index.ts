export interface User {
  id: number;
  email: string;
  role: "admin" | "user";
  plan: "basic" | "standard" | "premium";
  createdAt?: string;
}

export interface Profile {
  id: number;
  userId: number;
  name: string;
  avatarColor: string;
  avatarEmoji: string;
  isKids: boolean;
  pinHash?: string | null;
  isLocked?: boolean;
  preferredLanguage?: string;
  preferredAudio?: string;
  preferredSubtitle?: string;
  autoplayPreviews?: boolean;
  createdAt?: string;
}

export interface Genre {
  id: number;
  name: string;
  slug: string;
}

export interface ContentItem {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  type: "movie" | "series";
  releaseYear: number | null;
  maturityRating: string | null;
  duration: number | null;
  backdropUrl: string | null;
  posterUrl: string | null;
  trailerUrl: string | null;
  videoKey: string | null;
  hlsManifestKey: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  cast: string[];
  directors: string[];
  tags: string[];
  imdbRating: number | null;
  totalSeasons: number | null;
  introStartTime?: number | null;
  introEndTime?: number | null;
  creditsStartTime?: number | null;
  chapters?: Array<{ title: string; startTime: number }>;
  genres: Genre[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ChapterMarker {
  title: string;
  startTime: number;
}

export interface PlaybackTelemetryEvent {
  sessionId: string;
  profileId?: number | null;
  contentId: number;
  eventType: "startup" | "buffering" | "bitrate_change" | "seek" | "error" | "heartbeat";
  currentTime: number;
  startupLatencyMs?: number;
  bufferDurationMs?: number;
  currentBitrateBps?: number;
  currentResolution?: string;
  droppedFrames?: number;
  playerEngine?: "shaka" | "hls.js" | "native";
  errorMessage?: string;
}

export interface Episode {
  id: number;
  contentId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  videoKey: string | null;
  hlsManifestKey: string | null;
  createdAt?: string;
}

export interface WatchProgress {
  id: number;
  profileId: number;
  contentId: number;
  episodeId: number | null;
  progressSeconds: number;
  totalSeconds: number | null;
  completed: boolean;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export type VideoQuality = "auto" | "1080p" | "720p" | "480p" | "360p";
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
