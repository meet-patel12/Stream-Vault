"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Plus,
  Check,
  Star,
  Clock,
  Calendar,
  Users,
  Film,
  Tv,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentRow } from "@/components/content/content-row";
import { VideoPlayer } from "@/components/player/video-player";
import { Skeleton } from "@/components/ui/skeleton";
import { useContentStore } from "@/store/content-store";
import { useAuthStore } from "@/store/auth-store";
import type { ContentItem, Episode } from "@/types";
import toast from "react-hot-toast";
import { clsx } from "clsx";

export default function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { activeProfile } = useAuthStore();
  const { myList, addToMyList, removeFromMyList, getProgress, updateWatchProgress } =
    useContentStore();

  const [content, setContent] = useState<(ContentItem & { episodes?: Episode[] }) | null>(null);
  const [related, setRelated] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | "all">("all");
  const [isUpdatingList, setIsUpdatingList] = useState(false);
  const [showAllDescription, setShowAllDescription] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  const isInMyList = content ? myList.some((m) => m.id === content.id) : false;
  const progress = content ? getProgress(content.id) : undefined;

  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/content/${slug}`);
        if (!res.ok) {
          router.push("/browse");
          return;
        }
        const data = await res.json();
        if (data.success) {
          setContent(data.data);

          // Load related content using AI vector similarity
          try {
            const similarRes = await fetch(`/api/content/${slug}/similar?limit=12`);
            if (similarRes.ok) {
              const similarData = await similarRes.json();
              if (similarData.success && similarData.data?.items?.length > 0) {
                setRelated(similarData.data.items);
              }
            } else if (data.data.genres[0]) {
              // Fallback to genre query
              const relRes = await fetch(
                `/api/content?genre=${data.data.genres[0].slug}&limit=12`
              );
              const relData = await relRes.json();
              if (relData.success) {
                setRelated(
                  relData.data.items.filter((i: ContentItem) => i.id !== data.data.id)
                );
              }
            }
          } catch {
            // Silently ignore related fetch failure
          }
        }
      } catch {
        router.push("/browse");
      } finally {
        setIsLoading(false);
      }
    };
    loadContent();
  }, [slug, router]);

  const fetchVideoUrl = useCallback(
    async (videoKey: string, contentId?: number) => {
      setIsLoadingVideo(true);
      try {
        // 1. Attempt secure playback authorization with JWT, subscription, parental control & device limit checks
        if (contentId && activeProfile) {
          const authRes = await fetch("/api/stream/playback-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentId, profileId: activeProfile.id }),
          });
          const authData = await authRes.json();
          if (authData.success && (authData.data.hlsUrl || authData.data.dashUrl)) {
            return authData.data.hlsUrl || authData.data.dashUrl;
          } else if (authData.error?.code === "SUBSCRIPTION_REQUIRED") {
            toast.error("Active subscription required to stream this title.");
            router.push("/account");
            return "";
          } else if (authData.error?.code === "CONCURRENT_STREAM_LIMIT") {
            toast.error(authData.error.message || "Simultaneous stream limit reached on your plan.");
            return "";
          } else if (authData.error?.code === "PARENTAL_CONTROL_RESTRICTION") {
            toast.error(authData.error.message || "Parental control restricted.");
            return "";
          }
        }

        // 2. Fallback to signed-url endpoint
        const res = await fetch("/api/stream/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoKey }),
        });
        const data = await res.json();
        if (data.success) {
          return data.data.signedUrl || data.data.directUrl;
        }
        return "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
      } catch {
        return "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
      } finally {
        setIsLoadingVideo(false);
      }
    },
    [activeProfile, router]
  );

  const handlePlay = useCallback(
    async (episode?: Episode) => {
      if (!content) return;
      const key = episode?.videoKey ?? content.videoKey ?? "default";
      const url = await fetchVideoUrl(key, content.id);
      if (!url) return;
      setVideoUrl(url);
      setSelectedEpisode(episode ?? null);
      setIsPlayerOpen(true);
    },
    [content, fetchVideoUrl]
  );

  const lastProgressTimeRef = useRef<number>(0);

  const handleProgress = useCallback(
    async (currentTime: number, duration: number) => {
      if (!activeProfile || !content) return;
      const now = Date.now();
      // Throttle: update progress at most once every 10 seconds unless finished
      if (now - lastProgressTimeRef.current < 10000 && currentTime < duration - 2) return;
      lastProgressTimeRef.current = now;

      try {
        await fetch("/api/watch/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: activeProfile.id,
            contentId: content.id,
            episodeId: selectedEpisode?.id ?? null,
            progressSeconds: Math.floor(currentTime),
            totalSeconds: Math.floor(duration),
          }),
        });
        updateWatchProgress({
          id: 0,
          profileId: activeProfile.id,
          contentId: content.id,
          episodeId: selectedEpisode?.id ?? null,
          progressSeconds: Math.floor(currentTime),
          totalSeconds: Math.floor(duration),
          completed: duration > 0 && currentTime / duration > 0.9,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Fail silently
      }
    },
    [activeProfile, content, selectedEpisode, updateWatchProgress]
  );

  const handleListToggle = useCallback(async () => {
    if (!activeProfile || !content) return;
    setIsUpdatingList(true);
    try {
      if (isInMyList) {
        await fetch(
          `/api/my-list?profileId=${activeProfile.id}&contentId=${content.id}`,
          { method: "DELETE" }
        );
        removeFromMyList(content.id);
        toast.success("Removed from My List");
      } else {
        await fetch("/api/my-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: activeProfile.id, contentId: content.id }),
        });
        addToMyList(content);
        toast.success("Added to My List");
      }
    } catch {
      toast.error("Failed to update list");
    } finally {
      setIsUpdatingList(false);
    }
  }, [activeProfile, content, isInMyList, addToMyList, removeFromMyList]);

  const seasons = content?.episodes
    ? [...new Set(content.episodes.map((e) => e.seasonNumber))].sort()
    : [];

  const episodesBySeason = content?.episodes?.filter(
    (e) => e.seasonNumber === selectedSeason
  ) ?? [];

  const progressPercent =
    progress?.totalSeconds
      ? Math.min((progress.progressSeconds / progress.totalSeconds) * 100, 100)
      : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black pt-16">
        <Skeleton className="w-full h-[55vh]" />
        <div className="px-4 sm:px-8 py-8 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-4 w-80" />
          <div className="flex gap-3 mt-6">
            <Skeleton className="h-12 w-36 rounded-lg" />
            <Skeleton className="h-12 w-36 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const nextEpisode =
    selectedEpisode && content?.episodes
      ? content.episodes.find(
          (ep) =>
            (ep.seasonNumber === selectedEpisode.seasonNumber &&
              ep.episodeNumber === selectedEpisode.episodeNumber + 1) ||
            (ep.seasonNumber === selectedEpisode.seasonNumber + 1 && ep.episodeNumber === 1)
        )
      : null;

  const handleNextEpisode = useCallback(() => {
    if (nextEpisode) {
      handlePlay(nextEpisode);
      toast.success(
        `Playing Next: S${nextEpisode.seasonNumber}:E${nextEpisode.episodeNumber} ${nextEpisode.title}`
      );
    }
  }, [nextEpisode, handlePlay]);

  if (!content) return null;

  return (
    <div className="min-h-screen bg-black">
      {/* Full-Screen Player */}
      <AnimatePresence>
        {isPlayerOpen && videoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black"
          >
            <VideoPlayer
              key={videoUrl}
              src={videoUrl}
              title={
                selectedEpisode
                  ? `${content.title} — S${selectedEpisode.seasonNumber}:E${selectedEpisode.episodeNumber} ${selectedEpisode.title}`
                  : content.title
              }
              onClose={() => setIsPlayerOpen(false)}
              startTime={selectedEpisode ? 0 : (progress?.progressSeconds ?? 0)}
              onProgress={handleProgress}
              contentId={content.id}
              profileId={activeProfile?.id}
              introStartTime={content.introStartTime ?? undefined}
              introEndTime={content.introEndTime ?? undefined}
              creditsStartTime={content.creditsStartTime ?? undefined}
              chapters={content.chapters ?? undefined}
              onNextEpisode={nextEpisode ? handleNextEpisode : undefined}
              nextEpisodeTitle={nextEpisode?.title}
              nextEpisodeSubtitle={
                nextEpisode ? `S${nextEpisode.seasonNumber} • E${nextEpisode.episodeNumber}` : undefined
              }
              nextEpisodeThumbnail={nextEpisode?.thumbnailUrl || content.backdropUrl || undefined}
              thumbnailUrl={content.backdropUrl || content.posterUrl || undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <div className="relative w-full h-[55vh] min-h-[400px] overflow-hidden">
        {content.backdropUrl ? (
          <img
            src={content.backdropUrl}
            alt={content.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />

        {/* Play button overlay */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handlePlay()}
          className="absolute inset-0 flex items-center justify-center group"
        >
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm border-2 border-white/40 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-all">
            <Play size={32} fill="white" className="text-white ml-1" />
          </div>
        </motion.button>
      </div>

      {/* Content Details */}
      <div className="px-4 sm:px-8 py-8">
        <div className="max-w-4xl">
          {/* Type badge */}
          <div className="flex items-center gap-2 mb-3">
            {content.type === "movie" ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-zinc-800 px-2.5 py-1 rounded-full">
                <Film size={12} /> Movie
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-zinc-800 px-2.5 py-1 rounded-full">
                <Tv size={12} /> Series
              </span>
            )}
            {content.maturityRating && (
              <span className="text-xs border border-gray-600 text-gray-400 px-2 py-0.5 rounded">
                {content.maturityRating}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
            {content.title}
          </h1>

          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
            {content.imdbRating && (
              <span className="flex items-center gap-1.5 text-yellow-400 font-semibold">
                <Star size={14} fill="currentColor" />
                {content.imdbRating.toFixed(1)} IMDb
              </span>
            )}
            {content.releaseYear && (
              <span className="flex items-center gap-1.5 text-gray-400">
                <Calendar size={14} /> {content.releaseYear}
              </span>
            )}
            {content.duration && (
              <span className="flex items-center gap-1.5 text-gray-400">
                <Clock size={14} /> {content.duration} min
              </span>
            )}
            {content.totalSeasons && (
              <span className="text-gray-400">
                {content.totalSeasons} Season{content.totalSeasons > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Genres */}
          <div className="flex flex-wrap gap-2 mb-6">
            {content.genres.map((g, idx) => (
              <span
                key={g.id ? `${g.id}-${idx}` : idx}
                className="text-xs font-medium bg-white/10 text-gray-200 px-3 py-1 rounded-full border border-white/10"
              >
                {g.name}
              </span>
            ))}
          </div>

          {/* Progress Bar */}
          {progressPercent > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>
                  {progress?.completed ? "Watched" : "Continue watching"}
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-700 rounded-full">
                <div
                  className="h-full bg-red-600 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Button
              variant="primary"
              size="lg"
              isLoading={isLoadingVideo}
              onClick={() => handlePlay()}
              leftIcon={<Play size={18} fill="white" />}
              className="font-bold min-w-[140px]"
            >
              {progressPercent > 0 && !progress?.completed ? "Resume" : "Play"}
            </Button>
            <Button
              variant="glass"
              size="lg"
              isLoading={isUpdatingList}
              onClick={handleListToggle}
              leftIcon={isInMyList ? <Check size={16} /> : <Plus size={16} />}
            >
              {isInMyList ? "In My List" : "My List"}
            </Button>
          </div>

          {/* Description */}
          <div className="mb-8">
            <p
              className={clsx(
                "text-gray-300 text-base leading-relaxed",
                !showAllDescription && "line-clamp-3"
              )}
            >
              {content.description}
            </p>
            {content.description && content.description.length > 200 && (
              <button
                onClick={() => setShowAllDescription((v) => !v)}
                className="mt-2 text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                {showAllDescription ? (
                  <>Show less <ChevronUp size={14} /></>
                ) : (
                  <>Show more <ChevronDown size={14} /></>
                )}
              </button>
            )}
          </div>

          {/* Cast & Directors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            {content.cast && content.cast.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Users size={14} /> Cast
                </h3>
                <p className="text-white text-sm">
                  {(content.cast as string[]).join(", ")}
                </p>
              </div>
            )}
            {content.directors && content.directors.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-sm font-medium mb-2">🎬 Directed by</h3>
                <p className="text-white text-sm">
                  {(content.directors as string[]).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Episodes Section (Series) */}
        {content.type === "series" && content.episodes && content.episodes.length > 0 && (
          <div className="mb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <Tv size={24} className="text-blue-400" />
                  Episodes ({content.episodes.length})
                </h2>
                <p className="text-gray-400 text-xs mt-1">
                  All series episodes organized in one unified list
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSeason("all")}
                  className={clsx(
                    "px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all",
                    selectedSeason === "all"
                      ? "bg-red-600 text-white shadow-lg shadow-red-900/30"
                      : "bg-zinc-800 text-gray-300 hover:bg-zinc-700 hover:text-white"
                  )}
                >
                  All Episodes ({content.episodes.length})
                </button>
                {seasons.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSeason(s)}
                    className={clsx(
                      "px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all",
                      selectedSeason === s
                        ? "bg-white text-black shadow-md"
                        : "bg-zinc-800 text-gray-300 hover:bg-zinc-700 hover:text-white"
                    )}
                  >
                    Season {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {(selectedSeason === "all"
                ? content.episodes
                : episodesBySeason
              ).map((ep) => (
                <motion.div
                  key={ep.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4 p-4 bg-zinc-900/60 hover:bg-zinc-800/80 rounded-xl cursor-pointer group transition-all border border-white/5 hover:border-white/10 shadow-sm"
                  onClick={() => handlePlay(ep)}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-32 sm:w-44 aspect-video rounded-lg overflow-hidden bg-zinc-800 relative">
                    {ep.thumbnailUrl ? (
                      <img
                        src={ep.thumbnailUrl}
                        alt={ep.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film size={24} className="text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-[2px]">
                      <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                        <Play size={18} fill="white" className="text-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Episode Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            S{ep.seasonNumber} E{ep.episodeNumber}
                          </span>
                          {ep.duration && (
                            <span className="text-gray-400 text-xs">
                              {ep.duration} min
                            </span>
                          )}
                        </div>
                        <p className="text-white font-bold text-sm sm:text-base group-hover:text-red-400 transition-colors">
                          {ep.title}
                        </p>
                      </div>
                    </div>
                    {ep.description && (
                      <p className="text-gray-400 text-xs sm:text-sm mt-1.5 line-clamp-2 leading-relaxed">
                        {ep.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Related Content */}
        {related.length > 0 && (
          <ContentRow
            title="More Like This"
            items={related}
            size="md"
          />
        )}
      </div>
    </div>
  );
}
