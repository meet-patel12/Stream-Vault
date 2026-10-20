"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Film,
  Tv,
  Clock,
  Mic,
  MicOff,
  SlidersHorizontal,
  Star,
  Sparkles,
  Filter,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/types";
import { clsx } from "clsx";
import { Skeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const GENRES = [
  { label: "All Genres", slug: "" },
  { label: "Action", slug: "action" },
  { label: "Sci-Fi", slug: "sci-fi" },
  { label: "Drama", slug: "drama" },
  { label: "Comedy", slug: "comedy" },
  { label: "Thriller", slug: "thriller" },
  { label: "Romance", slug: "romance" },
  { label: "Crime", slug: "crime" },
];

export function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Faceted Filters
  const [selectedType, setSelectedType] = useState<"all" | "movie" | "series">("all");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [durationMax, setDurationMax] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setShowFilters(false);
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  }, [isOpen]);

  const performSearch = useCallback(
    async (
      q: string,
      type = selectedType,
      genre = selectedGenre,
      rating = minRating,
      duration = durationMax
    ) => {
      if (q.length < 2 && !genre && !rating && !duration && type === "all") {
        setResults([]);
        return;
      }
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (type !== "all") params.set("type", type);
      if (genre) params.set("genre", genre);
      if (rating) params.set("minRating", rating.toString());
      if (duration) params.set("durationMax", duration.toString());

      try {
        const res = await fetch(`/api/content/search?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setResults(data.data.items);
        } else {
          setError(data.error?.message ?? "Search failed");
        }
      } catch {
        setError("Search failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [selectedType, selectedGenre, minRating, durationMax]
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 250);
    },
    [performSearch]
  );

  // Trigger search when filters change
  const applyFilter = (newType = selectedType, newGenre = selectedGenre, newRating = minRating, newDur = durationMax) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    performSearch(query, newType, newGenre, newRating, newDur);
  };

  // Voice Search via Web Speech API
  const toggleVoiceSearch = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Voice search is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        toast("Listening... Speak title or actor", { icon: "🎙️" });
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setQuery(transcript);
          performSearch(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.error("Could not capture speech. Please try again.");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      toast.error("Unable to start voice recognition.");
    }
  };

  const handleSelect = (item: ContentItem) => {
    onClose();
    router.push(`/browse/watch/${item.slug}`);
  };

  const clearAllFilters = () => {
    setSelectedType("all");
    setSelectedGenre("");
    setMinRating(null);
    setDurationMax(null);
    if (query) {
      performSearch(query, "all", "", null, null);
    } else {
      setResults([]);
    }
  };

  const hasActiveFilters =
    selectedType !== "all" || selectedGenre !== "" || minRating !== null || durationMax !== null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed top-0 left-0 right-0 z-[70] bg-zinc-950/95 backdrop-blur-2xl border-b border-white/10 shadow-2xl max-h-[90vh] flex flex-col"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 sm:px-8 py-4 border-b border-white/5">
              <Search size={22} className="text-zinc-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search titles, actors, directors, genres, or keywords..."
                className="flex-1 bg-transparent text-white text-base sm:text-lg placeholder-zinc-500 outline-none"
              />

              {/* Voice Search Button */}
              <button
                type="button"
                onClick={toggleVoiceSearch}
                className={clsx(
                  "p-2.5 rounded-full transition-all flex items-center justify-center",
                  isListening
                    ? "bg-red-600 text-white animate-pulse shadow-[0_0_15px_#e50914]"
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
                )}
                title={isListening ? "Listening... Click to stop" : "Voice search"}
              >
                {isListening ? <Mic size={20} /> : <Mic size={20} />}
              </button>

              {/* Filter Toggle Button */}
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={clsx(
                  "p-2.5 rounded-full transition-all flex items-center gap-1.5 text-xs font-semibold",
                  showFilters || hasActiveFilters
                    ? "bg-red-600/20 text-red-400 border border-red-500/40"
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
                )}
                title="Toggle Filters"
              >
                <SlidersHorizontal size={18} />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>

              {isLoading && (
                <div className="w-5 h-5 border-2 border-white/20 border-t-red-500 rounded-full animate-spin flex-shrink-0" />
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all flex-shrink-0"
              >
                <X size={22} />
              </button>
            </div>

            {/* Faceted Filter Drawer */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 sm:px-8 py-3.5 bg-zinc-900/90 border-b border-white/10 flex flex-wrap items-center gap-4 text-xs overflow-hidden"
                >
                  {/* Type Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400 font-medium">Type:</span>
                    {(["all", "movie", "series"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setSelectedType(t);
                          applyFilter(t, selectedGenre, minRating, durationMax);
                        }}
                        className={clsx(
                          "px-2.5 py-1 rounded-md capitalize transition-all",
                          selectedType === t
                            ? "bg-white text-black font-bold shadow"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        )}
                      >
                        {t === "all" ? "All" : t === "movie" ? "Movies" : "Series"}
                      </button>
                    ))}
                  </div>

                  {/* Genre Filter */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-zinc-400 font-medium">Genre:</span>
                    {GENRES.slice(0, 6).map((g) => (
                      <button
                        key={g.slug}
                        onClick={() => {
                          setSelectedGenre(g.slug);
                          applyFilter(selectedType, g.slug, minRating, durationMax);
                        }}
                        className={clsx(
                          "px-2.5 py-1 rounded-md transition-all",
                          selectedGenre === g.slug
                            ? "bg-red-600 text-white font-bold"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        )}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>

                  {/* Min Rating Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400 font-medium">Rating:</span>
                    {[null, 7.0, 8.0, 8.5].map((r) => (
                      <button
                        key={r ?? "all"}
                        onClick={() => {
                          setMinRating(r);
                          applyFilter(selectedType, selectedGenre, r, durationMax);
                        }}
                        className={clsx(
                          "px-2.5 py-1 rounded-md transition-all flex items-center gap-1",
                          minRating === r
                            ? "bg-yellow-500 text-black font-bold"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        )}
                      >
                        {r ? (
                          <>
                            <Star size={11} fill="currentColor" /> {r}+
                          </>
                        ) : (
                          "Any"
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Duration Max Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400 font-medium">Duration:</span>
                    {[null, 90, 150].map((d) => (
                      <button
                        key={d ?? "all"}
                        onClick={() => {
                          setDurationMax(d);
                          applyFilter(selectedType, selectedGenre, minRating, d);
                        }}
                        className={clsx(
                          "px-2.5 py-1 rounded-md transition-all",
                          durationMax === d
                            ? "bg-white text-black font-bold"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        )}
                      >
                        {d === null ? "Any" : d === 90 ? "< 90m" : "< 150m"}
                      </button>
                    ))}
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="ml-auto text-red-400 hover:text-red-300 text-xs font-semibold underline"
                    >
                      Reset All
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results Grid */}
            <div className="flex-1 overflow-y-auto max-h-[65vh]">
              {error && <p className="text-red-400 text-sm px-8 py-4">{error}</p>}

              {isLoading && (
                <div className="px-4 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-zinc-900/50 rounded-xl">
                      <Skeleton className="w-20 h-14 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && results.length === 0 && (query.length >= 2 || hasActiveFilters) && !error && (
                <div className="px-8 py-12 text-center text-zinc-500">
                  <Search size={36} className="mx-auto mb-2 opacity-40 text-red-500" />
                  <p className="text-base text-zinc-300 font-medium">No results found</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Try checking for spelling errors, trying different keywords, or adjusting your filters.
                  </p>
                </div>
              )}

              {!isLoading && results.length > 0 && (
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between px-2 pb-3">
                    <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                      Found {results.length} result{results.length !== 1 ? "s" : ""}
                    </p>
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Sparkles size={11} className="text-emerald-400" /> Instant Fuzzy Match Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {results.map((item, idx) => (
                      <button
                        key={`${item.id}-${idx}`}
                        onClick={() => handleSelect(item)}
                        className="flex items-center gap-3.5 p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 hover:border-white/20 transition-all text-left group"
                      >
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-24 h-15 rounded-lg overflow-hidden bg-zinc-800 relative">
                          {item.backdropUrl || item.posterUrl ? (
                            <img
                              src={item.backdropUrl || item.posterUrl || ""}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {item.type === "movie" ? (
                                <Film size={18} className="text-zinc-600" />
                              ) : (
                                <Tv size={18} className="text-zinc-600" />
                              )}
                            </div>
                          )}
                          {item.maturityRating && (
                            <span className="absolute bottom-1 left-1 bg-black/80 text-[8px] font-bold px-1 rounded text-white">
                              {item.maturityRating}
                            </span>
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate group-hover:text-red-400 transition-colors">
                            {item.title}
                          </p>

                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 flex-wrap">
                            <span
                              className={clsx(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                item.type === "movie"
                                  ? "bg-red-950 text-red-300 border border-red-800/40"
                                  : "bg-blue-950 text-blue-300 border border-blue-800/40"
                              )}
                            >
                              {item.type === "movie" ? "Movie" : "Series"}
                            </span>

                            {item.imdbRating && (
                              <span className="text-yellow-400 flex items-center gap-0.5 font-bold text-[11px]">
                                <Star size={10} fill="currentColor" /> {item.imdbRating}
                              </span>
                            )}

                            {item.releaseYear && (
                              <span className="text-zinc-400 text-[11px]">{item.releaseYear}</span>
                            )}

                            {item.duration && (
                              <span className="text-zinc-500 text-[11px]">{item.duration}m</span>
                            )}
                          </div>

                          {/* Cast / Genres preview */}
                          {item.genres && item.genres[0] && (
                            <p className="text-[11px] text-zinc-500 truncate mt-1">
                              {item.genres.map((g) => g.name).join(" • ")}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
