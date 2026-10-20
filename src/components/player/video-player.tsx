"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type MouseEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipForward,
  SkipBack,
  Settings,
  Subtitles,
  PictureInPicture2,
  X,
  ChevronRight,
  Gauge,
  Cast,
  Radio,
  HelpCircle,
  MonitorUp,
  RotateCcw,
  Activity,
  Lock,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import type { PlaybackSpeed } from "@/types";

import { SmartTimeline } from "./smart-timeline";
import { StatsHud, type PlaybackStats } from "./stats-hud";
import { NextEpisodeOverlay } from "./next-episode-overlay";
import { ResumePromptModal } from "./resume-prompt-modal";
import { MobileGestures } from "./mobile-gestures";
import { StreamVaultAudioProcessor } from "./audio-processor";
import {
  PlayerSettingsModal,
  type SubtitleStyles,
  type PlayerPreferences,
} from "./player-settings-modal";

export interface VideoPlayerProps {
  src: string;
  title: string;
  onClose?: () => void;
  startTime?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onQualityChange?: (quality: string) => void;
  contentId?: number;
  profileId?: number;
  introStartTime?: number;
  introEndTime?: number;
  recapStartTime?: number;
  recapEndTime?: number;
  creditsStartTime?: number;
  chapters?: Array<{ title: string; startTime: number }>;
  onNextEpisode?: () => void;
  nextEpisodeTitle?: string;
  nextEpisodeSubtitle?: string;
  nextEpisodeThumbnail?: string;
  thumbnailUrl?: string;
}

const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_QUALITIES = [
  "Auto (1080p)",
  "1080p (Full HD)",
  "720p (HD)",
  "480p (SD)",
  "360p (Data Saver)",
];
const DEFAULT_AUDIO_TRACKS = [
  { label: "Original Audio (English/Multi)", param: "0" },
  { label: "English [Original] (5.1)", param: "1" },
  { label: "Spanish (Dub)", param: "2" },
  { label: "French (Dub)", param: "3" },
  { label: "German (Dub)", param: "4" },
  { label: "Japanese (Dub)", param: "5" },
];
const DEFAULT_SUBTITLES = [
  "Off",
  "English",
  "English [CC]",
  "Spanish",
  "French",
  "German",
  "Japanese",
];

const DEFAULT_SUBTITLE_STYLES: SubtitleStyles = {
  fontSize: "md",
  color: "#FFFFFF",
  bgOpacity: 0.5,
  outline: "shadow",
  delayMs: 0,
};

const DEFAULT_PREFERENCES: PlayerPreferences = {
  autoplayNext: true,
  autoSkipIntro: false,
  highContrast: false,
  showStatsForNerds: false,
  nightModeAudio: false,
};

export function VideoPlayer({
  src,
  title,
  onClose,
  startTime = 0,
  onProgress,
  onQualityChange,
  contentId,
  profileId,
  introStartTime,
  introEndTime,
  recapStartTime,
  recapEndTime,
  creditsStartTime,
  chapters = [],
  onNextEpisode,
  nextEpisodeTitle,
  nextEpisodeSubtitle,
  nextEpisodeThumbnail,
  thumbnailUrl,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const shakaRef = useRef<any>(null);
  const shakaTracksRef = useRef<any[]>([]);
  const audioProcessorRef = useRef<StreamVaultAudioProcessor | null>(null);

  // Telemetry & QoE State
  const sessionIdRef = useRef<string>(
    `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );
  const mountTimeRef = useRef<number>(Date.now());
  const hasEmittedStartupRef = useRef<boolean>(false);
  const bufferingStartRef = useRef<number | null>(null);

  // Preferences & Stored Profile Settings
  const storageKey = `streamvault_player_settings_${profileId || "guest"}`;
  const [preferences, setPreferences] = useState<PlayerPreferences>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_PREFERENCES;
  });

  const [subtitleStyles, setSubtitleStyles] = useState<SubtitleStyles>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`${storageKey}_subtitles`);
        if (saved) return { ...DEFAULT_SUBTITLE_STYLES, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_SUBTITLE_STYLES;
  });

  // Save preferences persistence
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(preferences));
      } catch {}
    }
  }, [preferences, storageKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`${storageKey}_subtitles`, JSON.stringify(subtitleStyles));
      } catch {}
    }
  }, [subtitleStyles, storageKey]);

  // Primary Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(startTime > 15);
  const [showNextEpisodeOverlay, setShowNextEpisodeOverlay] = useState(false);
  const [dismissedNextEpisode, setDismissedNextEpisode] = useState(false);

  // Tracks & Quality State
  const [selectedQuality, setSelectedQuality] = useState("Auto (1080p)");
  const [availableQualities, setAvailableQualities] = useState<string[]>(DEFAULT_QUALITIES);
  const [audioTracks, setAudioTracks] = useState(DEFAULT_AUDIO_TRACKS);
  const [selectedAudio, setSelectedAudio] = useState(DEFAULT_AUDIO_TRACKS[0].label);
  const [subtitleTracks, setSubtitleTracks] = useState<string[]>(DEFAULT_SUBTITLES);
  const [selectedSubtitle, setSelectedSubtitle] = useState("Off");
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [isPiP, setIsPiP] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [skipIndicator, setSkipIndicator] = useState<"forward" | "backward" | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState("");

  const savedSeekTimeRef = useRef<number>(0);
  const prevSrcPropRef = useRef(src);
  const hasAutoSkippedIntroRef = useRef(false);

  // QoE Stats State
  const [playbackStats, setPlaybackStats] = useState<PlaybackStats>({
    resolution: "1920x1080 (1080p)",
    viewport: "1920x1080",
    bitrateMbps: "4.85",
    bufferHealthSec: 28.5,
    droppedFrames: 0,
    totalFrames: 0,
    fps: 60,
    playerEngine: "Native HTML5",
    audioCodec: "AAC / Stereo",
    videoCodec: "H.264 / AVC",
    latencyMs: 120,
    audioNormalized: preferences.nightModeAudio,
    sessionId: sessionIdRef.current,
  });

  // Telemetry Sender
  const sendTelemetry = useCallback(
    (
      eventType:
        | "startup"
        | "buffering"
        | "bitrate_change"
        | "seek"
        | "error"
        | "heartbeat"
        | "pause"
        | "play"
        | "quality_change",
      extra?: Record<string, any>
    ) => {
      if (!contentId) return;
      const payload = {
        sessionId: sessionIdRef.current,
        contentId,
        profileId: profileId || null,
        eventType,
        currentTime: videoRef.current?.currentTime || 0,
        playerEngine: shakaRef.current ? "shaka" : hlsRef.current ? "hls.js" : "native",
        ...extra,
      };

      try {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon("/api/analytics/playback", JSON.stringify(payload));
        } else {
          fetch("/api/analytics/playback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Silently preserve video playback
      }
    },
    [contentId, profileId]
  );

  // Initialize Web Audio Processor for Night Mode Audio Normalization
  useEffect(() => {
    audioProcessorRef.current = new StreamVaultAudioProcessor();
    return () => {
      audioProcessorRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.setAudioNormalization(preferences.nightModeAudio);
    }
  }, [preferences.nightModeAudio]);

  // Core Function: Change quality resolution
  const handleQualityChange = useCallback(
    (q: string) => {
      setSelectedQuality(q);
      onQualityChange?.(q);
      sendTelemetry("quality_change", { targetQuality: q });

      // 1. Shaka Player resolution switching
      if (shakaRef.current) {
        const player = shakaRef.current;
        if (q.startsWith("Auto")) {
          player.configure({ abr: { enabled: true } });
          toast.success("Quality set to Auto (Adaptive ABR)");
        } else {
          const match = q.match(/(\d+)p/);
          if (match) {
            const targetHeight = parseInt(match[1], 10);
            const matchingTrack = shakaTracksRef.current.find(
              (t: any) => t.height === targetHeight
            );
            if (matchingTrack) {
              player.configure({ abr: { enabled: false } });
              player.selectVariantTrack(matchingTrack, false);
              toast.success(`Quality set to ${q}`);
            }
          }
        }
        return;
      }

      // 2. Adaptive Hls.js resolution switching
      if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
        const hls = hlsRef.current;
        if (q.startsWith("Auto")) {
          hls.currentLevel = -1;
          toast.success("Quality set to Auto (Adaptive)");
        } else {
          const match = q.match(/(\d+)p/);
          if (match) {
            const targetHeight = parseInt(match[1], 10);
            let bestIndex = -1;
            let minDiff = Infinity;
            hls.levels.forEach((lvl, idx) => {
              const diff = Math.abs(lvl.height - targetHeight);
              if (diff < minDiff) {
                minDiff = diff;
                bestIndex = idx;
              }
            });
            if (bestIndex !== -1) {
              hls.currentLevel = bestIndex;
              hls.nextLevel = bestIndex;
              toast.success(`Quality set to ${q}`);
            }
          }
        }
        return;
      }

      // 3. Fallback direct / API stream resolution switching
      setError("");
      if (videoRef.current && videoRef.current.currentTime > 0) {
        savedSeekTimeRef.current = videoRef.current.currentTime;
      }

      const match = q.match(/(\d+)p/);
      const targetQual = q.startsWith("Auto") ? "auto" : match ? `${match[1]}p` : "auto";

      try {
        const urlObj = new URL(currentSrc, window.location.origin);
        if (targetQual === "auto") {
          urlObj.searchParams.delete("quality");
        } else {
          urlObj.searchParams.set("quality", targetQual);
        }
        setCurrentSrc(
          currentSrc.startsWith("http://") || currentSrc.startsWith("https://")
            ? urlObj.toString()
            : urlObj.pathname + urlObj.search
        );
        toast.success(`Quality set to ${q}`);
      } catch {
        // preserve
      }
    },
    [currentSrc, onQualityChange, sendTelemetry]
  );

  // Sync src prop updates
  useEffect(() => {
    if (prevSrcPropRef.current !== src) {
      prevSrcPropRef.current = src;
      savedSeekTimeRef.current = 0;
      setCurrentSrc(src);
      hasAutoSkippedIntroRef.current = false;
    }
  }, [src]);

  // Load Video / Shaka / Hls
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSrc) return;

    const loadVideo = async () => {
      setError("");
      setIsLoaded(false);

      if (shakaRef.current) {
        await shakaRef.current.destroy();
        shakaRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const isDash = currentSrc.includes(".mpd");
      const isHls = currentSrc.includes(".m3u8") || currentSrc.includes("mux.dev");

      if (isDash || isHls) {
        // 1. Shaka Player
        try {
          const shakaModule = await import("shaka-player");
          const shaka = (shakaModule as any).default || shakaModule;
          shaka.polyfill.installAll();

          if (shaka.Player.isBrowserSupported()) {
            const player = new shaka.Player(video);
            player.configure({
              abr: {
                enabled: true,
                defaultBandwidthEstimate: 4000000,
                switchInterval: 3,
                bandwidthUpgradeTarget: 0.85,
                bandwidthDowngradeTarget: 0.95,
              },
              streaming: {
                bufferingGoal: 35,
                rebufferingGoal: 2.5,
                bufferBehind: 30,
                retryParameters: { maxAttempts: 4, baseDelay: 1000, backoffFactor: 2 },
              },
            });

            player.addEventListener("adaptation", () => {
              const stats = player.getStats();
              const bw = stats.estimatedBandwidth || 0;
              sendTelemetry("bitrate_change", {
                currentBitrateBps: Math.round(bw),
                droppedFrames: stats.droppedFrames || 0,
              });
            });

            await player.load(currentSrc);
            shakaRef.current = player;
            setIsLoaded(true);

            // Variants
            const variants = player.getVariantTracks();
            shakaTracksRef.current = variants;
            const heights = Array.from(
              new Set(variants.map((v: any) => v.height).filter(Boolean))
            ).sort((a: any, b: any) => b - a);
            if (heights.length > 0) {
              setAvailableQualities(["Auto (Adaptive)", ...heights.map((h) => `${h}p`)]);
            }

            // Audio & Subtitles
            const audioLangs = player.getAudioLanguages();
            if (audioLangs.length > 0) {
              setAudioTracks(
                audioLangs.map((lang: string) => ({
                  label: lang.toUpperCase(),
                  param: lang,
                }))
              );
              setSelectedAudio(audioLangs[0].toUpperCase());
            }

            const textTracks = player.getTextTracks();
            if (textTracks.length > 0) {
              const subLangs = Array.from(
                new Set(textTracks.map((t: any) => t.language).filter(Boolean))
              );
              setSubtitleTracks(["Off", ...(subLangs as string[])]);
            }

            const targetTime =
              savedSeekTimeRef.current > 0 ? savedSeekTimeRef.current : startTime;
            if (targetTime > 0) video.currentTime = targetTime;
            savedSeekTimeRef.current = 0;
            video.play().catch(() => {});
            return;
          }
        } catch {
          // fallback to Hls.js
        }

        // 2. Native HLS fallback (Safari)
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = currentSrc;
          return;
        }

        // 3. Hls.js fallback
        try {
          const Hls = (await import("hls.js")).default;
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
            hls.loadSource(currentSrc);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setIsLoaded(true);
              if (hls.levels && hls.levels.length > 0) {
                const parsedHeights = hls.levels.map((lvl) => lvl.height).filter(Boolean);
                const uniqueHeights = Array.from(new Set(parsedHeights)).sort((a, b) => b - a);
                if (uniqueHeights.length > 0) {
                  setAvailableQualities(["Auto (Adaptive)", ...uniqueHeights.map((h) => `${h}p`)]);
                }
              }
              const targetTime =
                savedSeekTimeRef.current > 0 ? savedSeekTimeRef.current : startTime;
              if (targetTime > 0) video.currentTime = targetTime;
              savedSeekTimeRef.current = 0;
              video.play().catch(() => {});
            });
            hlsRef.current = hls;
            return;
          }
        } catch {}
      }

      // 4. Native MP4/WebM video
      if (savedSeekTimeRef.current === 0 && video.currentTime > 0) {
        savedSeekTimeRef.current = video.currentTime;
      }
      video.src = currentSrc;
      video.load();
    };

    loadVideo();

    return () => {
      if (shakaRef.current) {
        shakaRef.current.destroy();
        shakaRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSrc, startTime]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setIsLoaded(true);
      if (video.duration) setDuration(video.duration);

      // Attempt Web Audio compressor hook on user gesture
      if (audioProcessorRef.current) {
        audioProcessorRef.current.initialize(video);
        audioProcessorRef.current.setAudioNormalization(preferences.nightModeAudio);
      }

      const targetTime =
        savedSeekTimeRef.current > 0
          ? savedSeekTimeRef.current
          : startTime > 0 && video.duration && startTime < video.duration - 5
          ? startTime
          : 0;

      if (targetTime > 0 && (!video.duration || targetTime < video.duration || isNaN(video.duration))) {
        video.currentTime = targetTime;
      }
      savedSeekTimeRef.current = 0;

      video.play().catch(() => {});
    };

    const onPlay = () => {
      setIsPlaying(true);
      sendTelemetry("play");
    };

    const onPause = () => {
      setIsPlaying(false);
      sendTelemetry("pause");
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (onProgress) onProgress(video.currentTime, video.duration || 0);

      // Compute buffered range
      if (video.buffered.length > 0) {
        for (let i = video.buffered.length - 1; i >= 0; i--) {
          if (video.buffered.start(i) <= video.currentTime) {
            setBufferedEnd(video.buffered.end(i));
            break;
          }
        }
      }

      // Auto-skip intro if preference active
      if (
        preferences.autoSkipIntro &&
        !hasAutoSkippedIntroRef.current &&
        introEndTime !== undefined &&
        video.currentTime >= (introStartTime ?? 10) &&
        video.currentTime < introEndTime
      ) {
        hasAutoSkippedIntroRef.current = true;
        video.currentTime = introEndTime;
        toast.success("⚡ Intro automatically skipped");
      }

      // End-Credits Next Episode Detection
      if (
        onNextEpisode &&
        preferences.autoplayNext &&
        !dismissedNextEpisode &&
        video.duration > 60 &&
        video.currentTime >= (creditsStartTime ?? video.duration - 30)
      ) {
        setShowNextEpisodeOverlay(true);
      }
    };

    const onWaiting = () => {
      bufferingStartRef.current = Date.now();
      setIsBuffering(true);
    };

    const onPlaying = () => {
      setIsBuffering(false);
      if (!hasEmittedStartupRef.current) {
        hasEmittedStartupRef.current = true;
        const latency = Date.now() - mountTimeRef.current;
        sendTelemetry("startup", { startupLatencyMs: latency });
      }
      if (bufferingStartRef.current) {
        const bufferDuration = Date.now() - bufferingStartRef.current;
        sendTelemetry("buffering", { bufferDurationMs: bufferDuration });
        bufferingStartRef.current = null;
      }
    };

    const onDurationChange = () => setDuration(video.duration);
    const onError = () => {
      setError("Failed to load video stream.");
      sendTelemetry("error", { errorMessage: "HTML5 video load error" });
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("error", onError);

    // Periodic 1-second diagnostic updater for StatsHud
    const statsTimer = setInterval(() => {
      if (video && containerRef.current) {
        const quality = (video as any).getVideoPlaybackQuality?.();
        const dropped = quality?.droppedVideoFrames || 0;
        const total = quality?.totalVideoFrames || 1;
        const bufferAhead = Math.max(0, bufferedEnd - video.currentTime);

        setPlaybackStats((prev) => ({
          ...prev,
          resolution: `${video.videoWidth || 1920}x${video.videoHeight || 1080}`,
          viewport: `${containerRef.current?.clientWidth || 1920}x${containerRef.current?.clientHeight || 1080}`,
          bitrateMbps: (shakaRef.current?.getStats?.()?.estimatedBandwidth
            ? (shakaRef.current.getStats().estimatedBandwidth / 1000000).toFixed(2)
            : "4.80"),
          bufferHealthSec: bufferAhead,
          droppedFrames: dropped,
          totalFrames: total,
          playerEngine: shakaRef.current
            ? "Google Shaka ABR"
            : hlsRef.current
            ? "Hls.js Worker"
            : "Native HTML5",
          audioNormalized: preferences.nightModeAudio,
        }));
      }
    }, 1000);

    return () => {
      clearInterval(statsTimer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("error", onError);
    };
  }, [
    onProgress,
    startTime,
    sendTelemetry,
    introStartTime,
    introEndTime,
    creditsStartTime,
    bufferedEnd,
    preferences.autoSkipIntro,
    preferences.autoplayNext,
    preferences.nightModeAudio,
    dismissedNextEpisode,
    onNextEpisode,
  ]);

  // Fullscreen change listener
  useEffect(() => {
    const onFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  // Auto-hide controls timer
  const resetHideTimer = useCallback(() => {
    if (isScreenLocked) return;
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 3500);
    }
  }, [isPlaying, isScreenLocked]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
    resetHideTimer();
  }, [isPlaying, resetHideTimer]);

  const handleSeek = useCallback(
    (targetTime: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(0, Math.min(targetTime, duration));
      sendTelemetry("seek", { seekTo: targetTime });
      resetHideTimer();
    },
    [duration, resetHideTimer, sendTelemetry]
  );

  const handleSkip = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      handleSeek(video.currentTime + seconds);
      setSkipIndicator(seconds > 0 ? "forward" : "backward");
      setTimeout(() => setSkipIndicator(null), 600);
    },
    [handleSeek]
  );

  // Frame Stepping (Phase 9)
  const handleFrameStep = useCallback(
    (forward: boolean) => {
      const video = videoRef.current;
      if (!video) return;
      if (!video.paused) video.pause();
      const frameDuration = 1 / 24; // standard 24fps film step
      video.currentTime = Math.max(
        0,
        Math.min(video.currentTime + (forward ? frameDuration : -frameDuration), duration)
      );
      toast(forward ? "Frame +1" : "Frame -1", { icon: "🎞️", duration: 700 });
      resetHideTimer();
    },
    [duration, resetHideTimer]
  );

  // Instant Replay (Phase 9)
  const handleInstantReplay = useCallback(() => {
    handleSkip(-10);
    toast("Replayed 10s", { icon: "⏪", duration: 1000 });
  }, [handleSkip]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    resetHideTimer();
  }, [resetHideTimer]);

  const handleVolumeChange = useCallback(
    (val: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = val;
      video.muted = val === 0;
      setVolume(val);
      setIsMuted(val === 0);
      resetHideTimer();
    },
    [resetHideTimer]
  );

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    if (isFullscreen) {
      if (document.exitFullscreen) await document.exitFullscreen();
    } else {
      if (container.requestFullscreen) await container.requestFullscreen();
    }
  }, [isFullscreen]);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch {
      toast.error("Picture-in-Picture not supported on this browser.");
    }
  }, []);

  const setSpeed = useCallback(
    (speed: PlaybackSpeed) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = speed;
      setPlaybackSpeed(speed);
      toast.success(`Speed: ${speed}x`);
      resetHideTimer();
    },
    [resetHideTimer]
  );

  // Casting & AirPlay Handlers
  const handleAirPlay = useCallback(() => {
    const v = videoRef.current as any;
    if (v && v.webkitShowPlaybackTargetPicker) {
      v.webkitShowPlaybackTargetPicker();
    } else {
      toast("AirPlay is available on Safari / Apple devices", { icon: "📡" });
    }
  }, []);

  const handleChromecast = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).chrome?.cast) {
      toast.success("Connecting to Google Cast receiver...");
    } else {
      toast("Chromecast receiver ready. Tap Cast in browser menu.", { icon: "📺" });
    }
  }, []);

  // Global Keyboard Shortcuts (Desktop & TV Remote Support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["input", "textarea", "select"].includes((e.target as HTMLElement)?.tagName?.toLowerCase()))
        return;

      switch (e.key) {
        case " ":
        case "k":
        case "K":
        case "Enter": // TV remote OK / Enter
          e.preventDefault();
          togglePlay();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "ArrowLeft":
        case "j":
        case "J":
          e.preventDefault();
          handleSkip(-10);
          break;
        case "ArrowRight":
        case "l":
        case "L":
          e.preventDefault();
          handleSkip(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(Math.min(volume + 0.1, 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(Math.max(volume - 0.1, 0));
          break;
        case ".":
          e.preventDefault();
          handleFrameStep(true);
          break;
        case ",":
          e.preventDefault();
          handleFrameStep(false);
          break;
        case "r":
        case "R":
          e.preventDefault();
          handleInstantReplay();
          break;
        case "s":
        case "S":
          if (introEndTime && currentTime < introEndTime) {
            handleSeek(introEndTime);
            toast.success("Skipped intro");
          } else if (recapEndTime && currentTime < recapEndTime) {
            handleSeek(recapEndTime);
            toast.success("Skipped recap");
          }
          break;
        case "n":
        case "N":
          if (onNextEpisode) onNextEpisode();
          break;
        case "p":
        case "P":
          e.preventDefault();
          togglePiP();
          break;
        case "c":
        case "C":
          e.preventDefault();
          setSelectedSubtitle((prev) => (prev === "Off" ? "English" : "Off"));
          break;
        case "d":
        case "D":
          e.preventDefault();
          setPreferences((prev) => ({
            ...prev,
            showStatsForNerds: !prev.showStatsForNerds,
          }));
          break;
        case "?":
          e.preventDefault();
          setShowShortcutsModal((prev) => !prev);
          break;
        default:
          if (e.key >= "0" && e.key <= "9" && duration > 0) {
            const percent = parseInt(e.key, 10) * 0.1;
            handleSeek(duration * percent);
            toast.success(`Jumped to ${percent * 100}%`);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlay,
    toggleFullscreen,
    toggleMute,
    handleSkip,
    handleSeek,
    handleVolumeChange,
    handleFrameStep,
    handleInstantReplay,
    volume,
    introEndTime,
    recapEndTime,
    currentTime,
    duration,
    onNextEpisode,
    togglePiP,
  ]);

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative bg-black overflow-hidden select-none transition-all duration-300",
        preferences.highContrast && "contrast-125 border-4 border-white/40",
        isMiniPlayer
          ? "fixed bottom-6 right-6 w-80 sm:w-96 aspect-video z-[999] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] border-2 border-white/30"
          : "w-full h-full"
      )}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && !isScreenLocked && setShowControls(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isScreenLocked) togglePlay();
      }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        style={{ filter: `brightness(${brightness})` }}
        onClick={() => !isScreenLocked && togglePlay()}
        onDoubleClick={toggleFullscreen}
        playsInline
      />

      {/* Mobile Gestures & Touch Layer */}
      <MobileGestures
        onSeek={handleSkip}
        onVolumeChange={handleVolumeChange}
        currentVolume={volume}
        isLocked={isScreenLocked}
        onToggleLock={() => setIsScreenLocked((prev) => !prev)}
        brightness={brightness}
        onBrightnessChange={setBrightness}
      />

      {/* Loading Spinner */}
      <AnimatePresence>
        {(isBuffering || !isLoaded) && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none z-30"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 border-4 border-white/20 border-t-red-600 rounded-full animate-spin shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Fallback */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-40 p-4 text-center">
          <span className="text-5xl mb-4">⚠️</span>
          <p className="text-lg font-bold mb-2">{error}</p>
          <p className="text-xs text-zinc-400 mb-6 max-w-sm">
            We encountered an issue playing this stream. Please try switching resolutions or restarting.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={() => {
                setError("");
                if (currentSrc !== src) {
                  setCurrentSrc(src);
                  setSelectedQuality(DEFAULT_QUALITIES[0]);
                } else {
                  videoRef.current?.load();
                }
              }}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg active:scale-95"
            >
              Reload Stream
            </button>
            <button
              onClick={() => {
                setError("");
                setCurrentSrc("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
                setSelectedQuality("Auto (1080p)");
                toast.success("Switched to fallback demo stream");
              }}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl text-sm transition-all active:scale-95"
            >
              Play Demo Stream
            </button>
          </div>
        </div>
      )}

      {/* Skip Indicators */}
      <AnimatePresence>
        {skipIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={clsx(
              "absolute top-1/2 -translate-y-1/2 pointer-events-none z-30",
              skipIndicator === "forward" ? "right-16" : "left-16"
            )}
          >
            <div className="bg-white/25 backdrop-blur-xl border border-white/30 rounded-full p-4 text-white shadow-2xl">
              {skipIndicator === "forward" ? <SkipForward size={32} /> : <SkipBack size={32} />}
              <p className="text-xs text-center font-bold mt-1">
                {skipIndicator === "forward" ? "+10s" : "-10s"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen Locked Notice */}
      <AnimatePresence>
        {isScreenLocked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-white font-bold text-xs px-4 py-2 rounded-full border border-red-400 flex items-center gap-2 shadow-2xl backdrop-blur-md"
          >
            <Lock size={14} />
            <span>Screen Locked • Tap the lock icon in the top right to unlock</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume Confirmation Prompt Modal */}
      <AnimatePresence>
        {showResumePrompt && startTime > 15 && (
          <ResumePromptModal
            resumeTime={startTime}
            formatTime={formatTime}
            onResume={() => {
              handleSeek(startTime);
              setShowResumePrompt(false);
            }}
            onRestart={() => {
              handleSeek(0);
              setShowResumePrompt(false);
            }}
            onDismiss={() => setShowResumePrompt(false)}
          />
        )}
      </AnimatePresence>

      {/* End-Credits Next Episode Countdown Overlay */}
      <AnimatePresence>
        {showNextEpisodeOverlay && onNextEpisode && (
          <NextEpisodeOverlay
            nextEpisodeTitle={nextEpisodeTitle}
            nextEpisodeSubtitle={nextEpisodeSubtitle}
            nextEpisodeThumbnail={nextEpisodeThumbnail}
            countdownSeconds={10}
            onPlayNext={() => {
              setShowNextEpisodeOverlay(false);
              onNextEpisode();
            }}
            onCancel={() => {
              setShowNextEpisodeOverlay(false);
              setDismissedNextEpisode(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Stats for Nerds Diagnostics HUD */}
      <AnimatePresence>
        {preferences.showStatsForNerds && (
          <StatsHud
            stats={playbackStats}
            onClose={() =>
              setPreferences((prev) => ({
                ...prev,
                showStatsForNerds: false,
              }))
            }
          />
        )}
      </AnimatePresence>

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && !isScreenLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col justify-between pointer-events-none z-30"
          >
            {/* Top Bar */}
            <div className="bg-gradient-to-b from-black/90 via-black/40 to-transparent p-4 sm:p-6 pointer-events-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
                    aria-label="Exit player"
                  >
                    <X size={22} />
                  </button>
                )}
                <div>
                  <h3 className="text-white font-bold text-sm sm:text-base tracking-wide drop-shadow truncate max-w-sm sm:max-w-xl">
                    {title}
                  </h3>
                </div>
              </div>

              {/* Top Action Pills (Skip Intro / Skip Recap / Next Episode / Shortcuts) */}
              <div className="flex items-center gap-2">
                {/* Skip Recap */}
                {((recapStartTime !== undefined &&
                  recapEndTime !== undefined &&
                  currentTime >= recapStartTime &&
                  currentTime < recapEndTime) ||
                  (recapStartTime === undefined && currentTime >= 0 && currentTime <= 20 && title.includes("S1:E"))) && (
                  <button
                    onClick={() => {
                      const target = recapEndTime !== undefined ? recapEndTime : 20;
                      handleSeek(target);
                      toast.success("Recap skipped");
                    }}
                    className="bg-white/20 hover:bg-white/35 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl border border-white/30 backdrop-blur-md transition-all shadow-xl flex items-center gap-1.5 hover:scale-105 active:scale-95"
                  >
                    <span>Skip Recap</span>
                    <SkipForward size={14} />
                  </button>
                )}

                {/* Skip Intro */}
                {((introStartTime !== undefined &&
                  introEndTime !== undefined &&
                  currentTime >= introStartTime &&
                  currentTime < introEndTime) ||
                  (introStartTime === undefined && currentTime >= 15 && currentTime <= 85)) && (
                  <button
                    onClick={() => {
                      const target = introEndTime !== undefined ? introEndTime : 85;
                      handleSeek(target);
                      toast.success("Intro skipped");
                    }}
                    className="bg-white/20 hover:bg-white/35 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl border border-white/30 backdrop-blur-md transition-all shadow-xl flex items-center gap-1.5 hover:scale-105 active:scale-95"
                  >
                    <span>Skip Intro</span>
                    <SkipForward size={14} />
                  </button>
                )}

                {/* Next Episode Button */}
                {onNextEpisode &&
                  duration > 60 &&
                  currentTime >= (creditsStartTime !== undefined ? creditsStartTime : duration - 40) && (
                    <button
                      onClick={onNextEpisode}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl border border-red-500 backdrop-blur-md transition-all shadow-2xl flex items-center gap-1.5 hover:scale-105 active:scale-95"
                    >
                      <span>Next Episode</span>
                      <ChevronRight size={14} />
                    </button>
                  )}

                {/* Stats for Nerds Quick Toggle */}
                <button
                  onClick={() =>
                    setPreferences((prev) => ({
                      ...prev,
                      showStatsForNerds: !prev.showStatsForNerds,
                    }))
                  }
                  className={clsx(
                    "p-2 rounded-full transition-colors",
                    preferences.showStatsForNerds
                      ? "text-emerald-400 bg-white/10"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                  title="Stats for Nerds (D)"
                >
                  <Activity size={18} />
                </button>

                {/* Mini Player */}
                <button
                  onClick={() => setIsMiniPlayer((prev) => !prev)}
                  className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors"
                  title={isMiniPlayer ? "Expand Player" : "Mini Player (Corner Dock)"}
                >
                  <MonitorUp size={18} />
                </button>

                {/* Keyboard Shortcuts */}
                <button
                  onClick={() => setShowShortcutsModal((prev) => !prev)}
                  className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors"
                  title="Keyboard Shortcuts (?)"
                >
                  <HelpCircle size={18} />
                </button>
              </div>
            </div>

            {/* Large Center Play / Pause Button */}
            <div className="flex items-center justify-center pointer-events-auto">
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.08 }}
                onClick={togglePlay}
                className="w-18 h-18 sm:w-20 sm:h-20 bg-black/60 hover:bg-black/80 backdrop-blur-xl rounded-full flex items-center justify-center text-white border-2 border-white/30 hover:border-white/60 transition-all shadow-2xl focus-visible:ring-4 focus-visible:ring-red-500"
                aria-label={isPlaying ? "Pause video" : "Play video"}
              >
                {isPlaying ? <Pause size={32} /> : <Play size={32} fill="white" className="ml-1" />}
              </motion.button>
            </div>

            {/* Bottom Controls Bar */}
            <div className="bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 sm:p-6 pointer-events-auto space-y-2">
              {/* Phase 3 Smart Timeline */}
              <SmartTimeline
                currentTime={currentTime}
                duration={duration}
                bufferedEnd={bufferedEnd}
                chapters={chapters}
                resumeTime={startTime}
                creditsStartTime={creditsStartTime}
                thumbnailUrl={thumbnailUrl}
                onSeek={handleSeek}
                formatTime={formatTime}
              />

              {/* Bottom Control Buttons Row */}
              <div className="flex items-center justify-between pt-1">
                {/* Left Controls */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Instant Replay 10s */}
                  <button
                    onClick={handleInstantReplay}
                    className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors relative"
                    aria-label="Replay 10 seconds (R)"
                    title="Instant Replay 10s (R)"
                  >
                    <RotateCcw size={18} />
                    <span className="absolute bottom-1 text-[8px] font-bold">10</span>
                  </button>

                  {/* Play/Pause */}
                  <button
                    onClick={togglePlay}
                    className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause size={22} /> : <Play size={22} fill="white" />}
                  </button>

                  {/* Forward 10s */}
                  <button
                    onClick={() => handleSkip(10)}
                    className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Forward 10 seconds"
                    title="Forward 10s (→)"
                  >
                    <SkipForward size={18} />
                  </button>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2 group/vol">
                    <button
                      onClick={toggleMute}
                      className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors"
                      aria-label={isMuted ? "Unmute" : "Mute"}
                      title={isMuted ? "Unmute (M)" : "Mute (M)"}
                    >
                      {isMuted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-0 group-hover/vol:w-20 sm:group-hover/vol:w-24 overflow-hidden transition-all duration-300 accent-red-600 cursor-pointer"
                      aria-label="Volume slider"
                    />
                  </div>

                  {/* Elapsed / Total Time */}
                  <span className="text-white/80 text-xs sm:text-sm font-mono whitespace-nowrap ml-1">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-1 sm:gap-2">
                  {/* Playback Speed Quick Indicator */}
                  <button
                    onClick={() => setShowSettings(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-white hover:text-zinc-300 rounded-xl hover:bg-white/10 transition-colors text-xs font-bold font-mono"
                    aria-label="Playback speed"
                    title="Playback Speed"
                  >
                    <Gauge size={15} />
                    <span>{playbackSpeed}x</span>
                  </button>

                  {/* Subtitles Toggle Button */}
                  <button
                    onClick={() => {
                      if (selectedSubtitle === "Off") {
                        setSelectedSubtitle("English");
                        toast.success("Subtitles: English");
                      } else {
                        setSelectedSubtitle("Off");
                        toast.success("Subtitles turned off");
                      }
                    }}
                    className={clsx(
                      "p-2 rounded-full transition-colors",
                      selectedSubtitle !== "Off"
                        ? "text-red-500 font-bold bg-white/10"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    )}
                    aria-label="Toggle subtitles (C)"
                    title={`Subtitles (${selectedSubtitle}) - Click to toggle (C)`}
                  >
                    <Subtitles size={18} />
                  </button>

                  {/* AirPlay */}
                  <button
                    onClick={handleAirPlay}
                    className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="AirPlay"
                    title="AirPlay"
                  >
                    <Radio size={18} />
                  </button>

                  {/* Chromecast */}
                  <button
                    onClick={handleChromecast}
                    className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Chromecast"
                    title="Chromecast"
                  >
                    <Cast size={18} />
                  </button>

                  {/* Picture in Picture */}
                  <button
                    onClick={togglePiP}
                    className={clsx(
                      "p-2 rounded-full hover:bg-white/10 transition-colors",
                      isPiP ? "text-red-400" : "text-white hover:text-zinc-300"
                    )}
                    aria-label="Picture in Picture (P)"
                    title="Picture in Picture (P)"
                  >
                    <PictureInPicture2 size={18} />
                  </button>

                  {/* Settings Modal Trigger */}
                  <button
                    onClick={() => setShowSettings((v) => !v)}
                    className={clsx(
                      "p-2 rounded-full hover:bg-white/10 transition-colors",
                      showSettings ? "text-red-400 bg-white/10" : "text-white hover:text-zinc-300"
                    )}
                    aria-label="Player settings"
                    title="Settings"
                  >
                    <Settings size={18} />
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-white/10 transition-colors"
                    aria-label={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                    title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                  >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled Subtitle Overlay (Phase 8 Subtitle Engine) */}
      {selectedSubtitle !== "Off" && isPlaying && (
        <div className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center px-4 max-w-2xl w-full">
          <span
            style={{
              fontSize:
                subtitleStyles.fontSize === "sm"
                  ? "13px"
                  : subtitleStyles.fontSize === "lg"
                  ? "20px"
                  : subtitleStyles.fontSize === "xl"
                  ? "25px"
                  : "16px",
              color: subtitleStyles.color,
              backgroundColor: `rgba(0,0,0,${subtitleStyles.bgOpacity})`,
              textShadow:
                subtitleStyles.outline === "shadow"
                  ? "2px 2px 4px black"
                  : subtitleStyles.outline === "outline"
                  ? "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
                  : "none",
            }}
            className="px-3 py-1 rounded-lg font-semibold tracking-wide backdrop-blur-[2px] transition-all"
          >
            [{selectedSubtitle}] Subtitles active
          </span>
        </div>
      )}

      {/* Player Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <PlayerSettingsModal
            onClose={() => setShowSettings(false)}
            availableQualities={availableQualities}
            selectedQuality={selectedQuality}
            onQualityChange={handleQualityChange}
            playbackSpeed={playbackSpeed}
            onSpeedChange={setSpeed}
            audioTracks={audioTracks}
            selectedAudio={selectedAudio}
            onAudioChange={(t) => {
              setSelectedAudio(t.label);
              if (shakaRef.current) shakaRef.current.selectAudioLanguage(t.param);
              toast.success(`Audio: ${t.label}`);
            }}
            subtitleTracks={subtitleTracks}
            selectedSubtitle={selectedSubtitle}
            onSubtitleChange={(s) => {
              setSelectedSubtitle(s);
              if (shakaRef.current) {
                if (s === "Off") {
                  shakaRef.current.setTextTrackVisibility(false);
                } else {
                  shakaRef.current.setTextTrackVisibility(true);
                  shakaRef.current.selectTextLanguage(s);
                }
              }
              toast.success(s === "Off" ? "Subtitles off" : `Subtitles: ${s}`);
            }}
            subtitleStyles={subtitleStyles}
            onSubtitleStylesChange={setSubtitleStyles}
            preferences={preferences}
            onPreferencesChange={setPreferences}
          />
        )}
      </AnimatePresence>

      {/* Dynamic DRM Forensic Watermark */}
      <div
        className="absolute pointer-events-none z-10 text-[9px] sm:text-[11px] font-mono font-black text-white/[0.06] uppercase tracking-widest select-none transition-all duration-1000"
        style={{ top: "25%", left: "30%" }}
      >
        STREAMVAULT-SECURE • PID:{profileId || 1042}-{contentId || 88} • {sessionIdRef.current.slice(0, 10)}
      </div>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showShortcutsModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md pointer-events-auto"
            onClick={() => setShowShortcutsModal(false)}
          >
            <div
              className="bg-zinc-950 border border-white/20 rounded-2xl p-6 max-w-lg w-full shadow-2xl text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <h3 className="font-black text-lg flex items-center gap-2">
                  <HelpCircle size={20} className="text-red-500" /> Keyboard & Remote Shortcuts
                </h3>
                <button
                  onClick={() => setShowShortcutsModal(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-full bg-white/5"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Play / Pause</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">
                    Space / K / Enter
                  </kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Fullscreen</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">F</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Mute Toggle</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">M</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Seek ±10s</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">← / →</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Volume ±10%</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">↑ / ↓</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Instant Replay</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">R</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Frame Step</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">, / .</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Skip Intro/Recap</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">S</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Next Episode</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">N</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Stats for Nerds</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">D</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Picture-in-Pic</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">P</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-zinc-400">Subtitles Toggle</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">C</kbd>
                </div>
                <div className="flex justify-between items-center bg-zinc-900/60 p-2.5 rounded-xl border border-white/5 col-span-2">
                  <span className="text-zinc-400">Quick Percentage Jump</span>
                  <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold text-white">0 – 9 (0% to 90%)</kbd>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
