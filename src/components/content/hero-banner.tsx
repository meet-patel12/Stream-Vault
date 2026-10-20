"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Plus,
  Check,
  Info,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Star,
  Sparkles,
  Flame,
  Award,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { useContentStore } from "@/store/content-store";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import toast from "react-hot-toast";

interface HeroBannerProps {
  items: ContentItem[];
}

export function HeroBanner({ items }: HeroBannerProps) {
  const router = useRouter();
  const { activeProfile } = useAuthStore();
  const { myList, addToMyList, removeFromMyList } = useContentStore();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isUpdatingList, setIsUpdatingList] = useState(false);
  const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = items[currentIdx];
  const isInMyList = current ? myList.some((m) => m.id === current.id) : false;

  // Auto-rotate hero every 10 seconds if user isn't hovering video
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % items.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [items.length]);

  // Video preview delay trigger on slide change
  useEffect(() => {
    setShowVideo(false);
    setIsVideoLoaded(false);

    if (current?.trailerUrl) {
      videoTimerRef.current = setTimeout(() => {
        setShowVideo(true);
      }, 1800);
    }

    return () => {
      if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
    };
  }, [currentIdx, current?.trailerUrl]);

  const handleListToggle = useCallback(async () => {
    if (!activeProfile || !current) return;
    setIsUpdatingList(true);
    try {
      if (isInMyList) {
        const res = await fetch(
          `/api/my-list?profileId=${activeProfile.id}&contentId=${current.id}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          removeFromMyList(current.id);
          toast.success("Removed from My List");
        }
      } else {
        const res = await fetch("/api/my-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: activeProfile.id,
            contentId: current.id,
          }),
        });
        if (res.ok) {
          addToMyList(current);
          toast.success("Added to My List");
        }
      }
    } catch {
      toast.error("Failed to update list");
    } finally {
      setIsUpdatingList(false);
    }
  }, [activeProfile, current, isInMyList, addToMyList, removeFromMyList]);

  if (!current) return null;

  return (
    <div className="relative w-full h-[80vh] min-h-[580px] max-h-[850px] overflow-hidden select-none bg-black">
      {/* Background Static Backdrop */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`backdrop-${currentIdx}`}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className="absolute inset-0 z-0"
        >
          {current.backdropUrl ? (
            <img
              src={current.backdropUrl}
              alt={current.title}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Auto-playing Trailer Video Preview with Crossfade */}
      {showVideo && current.trailerUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isVideoLoaded ? 1 : 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 z-1"
        >
          <video
            ref={videoRef}
            src={current.trailerUrl}
            autoPlay
            playsInline
            muted={muted}
            loop
            onLoadedData={() => setIsVideoLoaded(true)}
            className="w-full h-full object-cover object-center"
          />
        </motion.div>
      )}

      {/* Multi-stage Cinematic Vignette & Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 to-transparent z-10" />

      {/* Content Meta Information */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end px-4 sm:px-12 pb-24 sm:pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={`meta-${currentIdx}`}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="max-w-2xl"
          >
            {/* Top Badge: Netflix Original / Top 10 */}
            <div className="flex items-center gap-2 mb-3.5 flex-wrap">
              <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-black px-3 py-1 rounded shadow-lg shadow-red-900/40 tracking-wider uppercase">
                <Flame size={14} className="fill-white" />
                #1 in Movies Today
              </span>
              {current.imdbRating && (
                <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-300 text-xs font-bold px-2.5 py-1 rounded border border-yellow-500/30 backdrop-blur-md">
                  <Star size={12} fill="currentColor" />
                  {current.imdbRating.toFixed(1)} Rating
                </span>
              )}
              <span className="bg-white/10 backdrop-blur-md text-emerald-400 text-xs font-bold px-2.5 py-1 rounded border border-white/15">
                98% Match
              </span>
              <span className="bg-white/10 backdrop-blur-md text-white text-xs font-bold px-2 py-0.5 rounded border border-white/20">
                ULTRA HD 4K
              </span>
            </div>

            {/* Cinematic Title */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none mb-4 drop-shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
              {current.title}
            </h1>

            {/* Metadata Pills */}
            <div className="flex items-center gap-3 mb-4 text-sm font-semibold text-zinc-300 flex-wrap">
              {current.releaseYear && <span className="text-white">{current.releaseYear}</span>}
              {current.maturityRating && (
                <span className="border border-zinc-500 text-zinc-300 text-xs font-bold px-1.5 py-0.5 rounded">
                  {current.maturityRating}
                </span>
              )}
              {current.duration && <span>{current.duration} mins</span>}
              {current.totalSeasons && (
                <span>
                  {current.totalSeasons} Season{current.totalSeasons > 1 ? "s" : ""}
                </span>
              )}
              <span className="text-zinc-400">·</span>
              <div className="flex gap-2">
                {current.genres.slice(0, 3).map((g, i) => (
                  <span key={`hero-genre-${current.id}-${g.id ?? g.slug ?? i}-${i}`} className="text-zinc-300">
                    {g.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Synopsis Description */}
            <p className="text-zinc-200 text-sm sm:text-base leading-relaxed mb-7 line-clamp-3 max-w-xl font-normal drop-shadow">
              {current.description}
            </p>

            {/* Interactive Action CTA Buttons */}
            <div className="flex items-center gap-3.5 flex-wrap">
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push(`/browse/watch/${current.slug}`)}
                leftIcon={<Play size={20} fill="white" />}
                className="bg-white hover:bg-zinc-200 text-black font-extrabold px-8 py-3.5 text-base rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95"
              >
                Play Now
              </Button>

              <Button
                variant="glass"
                size="lg"
                onClick={handleListToggle}
                isLoading={isUpdatingList}
                leftIcon={isInMyList ? <Check size={18} /> : <Plus size={18} />}
                className="bg-zinc-800/80 hover:bg-zinc-700/80 text-white font-bold px-6 py-3.5 text-base rounded-xl border border-white/20 backdrop-blur-xl transition-all hover:scale-105 active:scale-95"
              >
                {isInMyList ? "In My List" : "Add to My List"}
              </Button>

              <Button
                variant="ghost"
                size="lg"
                onClick={() => router.push(`/browse/watch/${current.slug}`)}
                leftIcon={<Info size={18} />}
                className="bg-white/10 hover:bg-white/20 text-white font-semibold px-5 py-3.5 text-base rounded-xl border border-white/10 backdrop-blur-md transition-all hover:scale-105 active:scale-95"
              >
                More Details
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Volume Toggle Control */}
      <div className="absolute bottom-24 sm:bottom-32 right-4 sm:right-12 z-20 flex items-center gap-3">
        <button
          onClick={() => setMuted((m) => !m)}
          className="w-11 h-11 rounded-full bg-black/60 border border-white/30 text-white hover:border-white hover:bg-black/90 flex items-center justify-center transition-all backdrop-blur-xl shadow-xl hover:scale-110 active:scale-95"
          aria-label={muted ? "Unmute preview" : "Mute preview"}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {/* Maturity Rating Pill */}
        <div className="border-l-4 border-red-600 bg-black/70 backdrop-blur-md px-3 py-1.5 text-white text-xs font-bold">
          {current.maturityRating ?? "PG-13"}
        </div>
      </div>

      {/* Slide Navigation Pagination */}
      {items.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
          <button
            onClick={() => setCurrentIdx((i) => (i - 1 + items.length) % items.length)}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft size={16} />
          </button>
          {items.map((_, i) => (
            <button
              key={`hero-dot-${i}`}
              onClick={() => setCurrentIdx(i)}
              className={clsx(
                "rounded-full transition-all duration-300",
                i === currentIdx
                  ? "w-7 h-2 bg-red-600 shadow-[0_0_10px_#e50914]"
                  : "w-2 h-2 bg-zinc-600 hover:bg-zinc-400"
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
          <button
            onClick={() => setCurrentIdx((i) => (i + 1) % items.length)}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
