"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ContentCard } from "@/components/content/content-card";
import { GridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useThemeStore } from "@/store/theme-store";
import type { ContentItem, Genre } from "@/types";
import {
  Film,
  SlidersHorizontal,
  Star,
  ArrowUpDown,
  Calendar,
  Sparkles,
  Layers,
  LayoutGrid,
  Check,
} from "lucide-react";

export default function MoviesPage() {
  const { playMicroInteraction } = useThemeStore();

  const [movies, setMovies] = useState<ContentItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<"newest" | "rating">("newest");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const observerTarget = useRef<HTMLDivElement>(null);

  const loadMovies = useCallback(
    async (genre = selectedGenre, sort = selectedSort, rating = minRating, cursor: number | null = null) => {
      if (cursor === null) setIsLoading(true);
      else setIsLoadingMore(true);

      try {
        const params = new URLSearchParams();
        params.set("type", "movie");
        params.set("limit", "24");
        params.set("sort", sort);
        if (genre) params.set("genre", genre);
        if (cursor) params.set("cursor", cursor.toString());

        const res = await fetch(`/api/content?${params.toString()}`);
        const data = await res.json();

        if (data.success && data.data) {
          let items: ContentItem[] = data.data.items || [];
          if (rating !== null) {
            items = items.filter((m) => (m.imdbRating || 0) >= rating);
          }

          if (cursor === null) {
            setMovies(items);
          } else {
            setMovies((prev) => [...prev, ...items]);
          }

          setNextCursor(data.data.nextCursor || null);
          setHasMore(Boolean(data.data.nextCursor));
        }
      } catch (err) {
        console.error("Failed to load movies:", err);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedGenre, selectedSort, minRating]
  );

  useEffect(() => {
    const loadGenres = async () => {
      try {
        const res = await fetch("/api/genres");
        const data = await res.json();
        if (data.success) setGenres(data.data);
      } catch {
        // Silently continue
      }
    };
    loadGenres();
    loadMovies();
  }, [loadMovies]);

  // Infinite Scroll Trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore && nextCursor) {
          loadMovies(selectedGenre, selectedSort, minRating, nextCursor);
        }
      },
      { threshold: 0.2 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasMore, isLoading, isLoadingMore, nextCursor, selectedGenre, selectedSort, minRating, loadMovies]);

  const handleGenreChange = (slug: string | null) => {
    playMicroInteraction("switch");
    setSelectedGenre(slug);
    loadMovies(slug, selectedSort, minRating, null);
  };

  const handleSortChange = (sort: "newest" | "rating") => {
    playMicroInteraction("switch");
    setSelectedSort(sort);
    loadMovies(selectedGenre, sort, minRating, null);
  };

  const handleRatingChange = (rating: number | null) => {
    playMicroInteraction("switch");
    setMinRating(rating);
    loadMovies(selectedGenre, selectedSort, rating, null);
  };

  return (
    <div className="min-h-screen bg-black text-white pt-20 sm:pt-24 pb-20 selection:bg-red-600 selection:text-white">
      {/* Page Header */}
      <div className="px-4 sm:px-8 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-1.5"
          >
            <div className="p-2 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
              <Film size={24} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Blockbuster Movies
            </h1>
          </motion.div>
          <p className="text-zinc-400 text-xs sm:text-sm">
            {isLoading ? "Curating cinema catalog..." : `${movies.length} titles streamed in 4K Ultra HD & Dolby Atmos`}
          </p>
        </div>

        {/* Filter Toggle & Sorting Toolbar */}
        <div className="flex items-center gap-2">
          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-xl p-1 text-xs font-semibold">
            <button
              data-focusable="true"
              onClick={() => handleSortChange("newest")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                selectedSort === "newest" ? "bg-white text-black font-bold shadow" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Sparkles size={13} /> Newest
            </button>
            <button
              data-focusable="true"
              onClick={() => handleSortChange("rating")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                selectedSort === "rating" ? "bg-white text-black font-bold shadow" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Star size={13} className="text-yellow-500" fill="currentColor" /> Top Rated
            </button>
          </div>

          {/* Advanced Filter Drawer Button */}
          <button
            data-focusable="true"
            onClick={() => {
              playMicroInteraction("click");
              setShowFilters((v) => !v);
            }}
            className={`p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
              showFilters || minRating !== null
                ? "bg-red-600/20 text-red-400 border-red-500/40"
                : "bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/25"
            }`}
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filters</span>
            {minRating !== null && <span className="w-2 h-2 rounded-full bg-red-500" />}
          </button>
        </div>
      </div>

      {/* Advanced Filter Drawer */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 sm:px-8 mb-6 overflow-hidden"
          >
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl flex flex-wrap items-center gap-6 text-xs">
              {/* IMDb Rating Threshold */}
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-bold uppercase tracking-wider">Min Rating:</span>
                {[null, 7.0, 8.0, 8.5].map((r) => (
                  <button
                    key={r ?? "all"}
                    data-focusable="true"
                    onClick={() => handleRatingChange(r)}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 font-semibold ${
                      minRating === r
                        ? "bg-yellow-500 text-black font-extrabold shadow"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {r ? <><Star size={11} fill="currentColor" /> {r}+</> : "Any"}
                  </button>
                ))}
              </div>

              {minRating !== null && (
                <button
                  onClick={() => handleRatingChange(null)}
                  className="text-red-400 hover:text-red-300 font-semibold underline ml-auto"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Horizontal Genre Carousel Pills */}
      <div className="px-4 sm:px-8 mb-8 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 pb-2">
          <button
            data-focusable="true"
            onClick={() => handleGenreChange(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              !selectedGenre
                ? "bg-red-600 text-white shadow-lg shadow-red-900/30"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5"
            }`}
          >
            All Genres
          </button>
          {genres.map((g, idx) => (
            <button
              key={g.id ? `${g.id}-${idx}` : idx}
              data-focusable="true"
              onClick={() => handleGenreChange(g.slug)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                selectedGenre === g.slug
                  ? "bg-red-600 text-white shadow-lg shadow-red-900/30"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="px-4 sm:px-8">
        {isLoading ? (
          <GridSkeleton count={18} />
        ) : movies.length === 0 ? (
          <EmptyState
            icon={Film}
            badge="No Movies Match"
            title="No Titles Found"
            description="We couldn't find any movies matching your active filter criteria. Try resetting your rating threshold or choosing a different genre."
            actionText="Clear Filters"
            onAction={() => {
              setSelectedGenre(null);
              setMinRating(null);
              loadMovies(null, selectedSort, null, null);
            }}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          >
            {movies.map((movie, idx) => (
              <motion.div
                key={`${movie.id}-${idx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.25 }}
              >
                <ContentCard item={movie} size="sm" />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Infinite Scroll Sentinel */}
        <div ref={observerTarget} className="py-10 text-center">
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 font-semibold">
              <div className="w-4 h-4 border-2 border-white/30 border-t-red-600 rounded-full animate-spin" />
              <span>Loading more titles...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
