"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Plus,
  Check,
  Info,
  Star,
  Clock,
  Film,
  Tv,
  ThumbsUp,
  Volume2,
  VolumeX,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { useContentStore } from "@/store/content-store";
import { clsx } from "clsx";
import { useThemeStore } from "@/store/theme-store";
import toast from "react-hot-toast";

interface ContentCardProps {
  item: ContentItem & { watchProgress?: { progressSeconds: number; totalSeconds: number | null } };
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  rank?: number;
}

export function ContentCard({
  item,
  size = "md",
  showProgress = false,
  rank,
}: ContentCardProps) {
  const router = useRouter();
  const { activeProfile } = useAuthStore();
  const { myList, addToMyList, removeFromMyList, getProgress } = useContentStore();
  const { playMicroInteraction } = useThemeStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isUpdatingList, setIsUpdatingList] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isInMyList = myList.some((m) => m.id === item.id);
  const localProgress = showProgress ? getProgress(item.id) : undefined;
  const progressData = item.watchProgress || localProgress;

  const progressPercent = progressData?.totalSeconds
    ? (progressData.progressSeconds / progressData.totalSeconds) * 100
    : 0;

  // Compute a realistic dynamic match score based on IMDb rating
  const matchScore = item.imdbRating
    ? Math.min(Math.round(item.imdbRating * 10 + 12), 99)
    : 95;

  const handlePlay = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      playMicroInteraction("click");
      router.push(`/browse/watch/${item.slug}`);
    },
    [router, item.slug, playMicroInteraction]
  );

  const handleInfo = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      playMicroInteraction("click");
      router.push(`/browse/watch/${item.slug}`);
    },
    [router, item.slug, playMicroInteraction]
  );

  const handleMouseEnter = () => {
    setIsHovered(true);
    playMicroInteraction("focus");
    if (item.trailerUrl) {
      hoverTimerRef.current = setTimeout(() => {
        setIsPlayingPreview(true);
      }, 500);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPlayingPreview(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleInfo();
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleListToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeProfile) {
        toast.error("Select a profile first");
        return;
      }
      setIsUpdatingList(true);
      try {
        if (isInMyList) {
          const res = await fetch(
            `/api/my-list?profileId=${activeProfile.id}&contentId=${item.id}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            removeFromMyList(item.id);
            toast.success("Removed from My List");
          }
        } else {
          const res = await fetch("/api/my-list", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileId: activeProfile.id,
              contentId: item.id,
            }),
          });
          if (res.ok) {
            addToMyList(item);
            toast.success("Added to My List");
          }
        }
      } catch {
        toast.error("Failed to update list");
      } finally {
        setIsUpdatingList(false);
      }
    },
    [activeProfile, isInMyList, item, addToMyList, removeFromMyList]
  );

  const handleLikeToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked((prev) => {
      const next = !prev;
      if (next) toast.success("Rated: Loved this!");
      return next;
    });
  };

  const widthClasses = {
    sm: "w-32 sm:w-40",
    md: "w-44 sm:w-56",
    lg: "w-56 sm:w-72",
  };

  return (
    <div
      data-focusable="true"
      tabIndex={0}
      role="button"
      aria-label={`${item.title} (${item.type === "movie" ? "Movie" : "Series"})`}
      onKeyDown={handleKeyDown}
      className={clsx(
        "relative flex-shrink-0 cursor-pointer group select-none outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-xl",
        widthClasses[size]
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleInfo}
    >
      {/* Outer Card Container */}
      <motion.div
        className="relative overflow-hidden rounded-xl bg-zinc-900 border border-white/5 transition-all duration-300"
        animate={{
          scale: isHovered ? 1.05 : 1,
          boxShadow: isHovered
            ? "0 22px 45px -10px rgba(0, 0, 0, 0.9), 0 0 25px rgba(229, 9, 20, 0.25)"
            : "0 4px 15px rgba(0, 0, 0, 0.4)",
          borderColor: isHovered ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.05)",
        }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        style={{ aspectRatio: "16/10" }}
      >
        {/* Poster / Backdrop Image */}
        {item.backdropUrl || item.posterUrl ? (
          <img
            src={item.backdropUrl || item.posterUrl || ""}
            alt={item.title}
            className={clsx(
              "w-full h-full object-cover transition-transform duration-700 ease-out",
              isHovered && "scale-108"
            )}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex flex-col items-center justify-center gap-2 p-2">
            {item.type === "movie" ? (
              <Film size={28} className="text-zinc-500" />
            ) : (
              <Tv size={28} className="text-zinc-500" />
            )}
            <span className="text-xs text-zinc-400 font-semibold text-center line-clamp-1">{item.title}</span>
          </div>
        )}

        {/* Live Preview Video on Hover */}
        {isPlayingPreview && item.trailerUrl && (
          <div className="absolute inset-0 z-10 bg-black">
            <video
              ref={videoRef}
              src={item.trailerUrl}
              autoPlay
              playsInline
              muted={isMuted}
              loop
              className="w-full h-full object-cover"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted((m) => !m);
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md transition-all z-20"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
          </div>
        )}

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
          {item.maturityRating && (
            <span className="bg-black/80 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/20">
              {item.maturityRating}
            </span>
          )}
          {item.type === "series" ? (
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow">
              SERIES
            </span>
          ) : (
            <span className="bg-red-600/90 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow">
              MOVIE
            </span>
          )}
        </div>

        {/* Top Right UHD / 4K Tag */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10 pointer-events-none">
          <span className="bg-zinc-900/80 backdrop-blur-md text-zinc-300 text-[9px] font-bold px-1 py-0.5 rounded border border-white/10">
            4K HDR
          </span>
        </div>

        {/* Progress Bar (Continue Watching) */}
        {progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800 z-20">
            <div
              className="h-full bg-red-600 transition-all shadow-[0_0_8px_#e50914]"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        )}

        {/* Bottom Title overlay when not hovered */}
        <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none">
          <p className="text-white text-xs sm:text-sm font-bold tracking-tight drop-shadow-md truncate">
            {item.title}
          </p>
        </div>

        {/* Hover Quick Action Drawer */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/90 to-transparent p-3 flex flex-col justify-end z-20"
            >
              {/* Action Buttons Row */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={handlePlay}
                  className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-all hover:scale-110 active:scale-95 shadow-lg"
                  title="Play"
                >
                  <Play size={14} fill="black" className="ml-0.5" />
                </button>

                <button
                  onClick={handleListToggle}
                  disabled={isUpdatingList}
                  className={clsx(
                    "w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:scale-110 active:scale-95 backdrop-blur-md",
                    isInMyList
                      ? "bg-red-600 border-red-500 text-white"
                      : "bg-black/60 border-white/30 text-white hover:border-white"
                  )}
                  title={isInMyList ? "Remove from My List" : "Add to My List"}
                >
                  {isUpdatingList ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isInMyList ? (
                    <Check size={14} />
                  ) : (
                    <Plus size={14} />
                  )}
                </button>

                <button
                  onClick={handleLikeToggle}
                  className={clsx(
                    "w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:scale-110 active:scale-95 backdrop-blur-md",
                    isLiked
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-black/60 border-white/30 text-white hover:border-white"
                  )}
                  title="Like"
                >
                  <ThumbsUp size={13} />
                </button>

                <button
                  onClick={handleInfo}
                  className="w-8 h-8 ml-auto rounded-full bg-black/60 border border-white/30 text-white flex items-center justify-center hover:border-white transition-all hover:scale-110 active:scale-95 backdrop-blur-md"
                  title="Episode Details & Info"
                >
                  <Info size={14} />
                </button>
              </div>

              {/* Match Score & Badges */}
              <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-300 mb-1 flex-wrap">
                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                  <Sparkles size={11} /> {matchScore}% Match
                </span>
                {item.releaseYear && <span>{item.releaseYear}</span>}
                {item.duration && <span>{item.duration}m</span>}
                {item.totalSeasons && (
                  <span>
                    {item.totalSeasons} Season{item.totalSeasons > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Genres Pills */}
              <div className="flex items-center gap-1.5 overflow-hidden text-[10px] text-zinc-400">
                {item.genres?.slice(0, 3).map((g, i) => (
                  <span key={`card-${item.id}-genre-${g.id ?? "g"}-${i}`} className="truncate">
                    {g.name}
                    {i < Math.min(item.genres.length - 1, 2) && " •"}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
