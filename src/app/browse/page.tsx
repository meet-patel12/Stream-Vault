"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { HeroBanner } from "@/components/content/hero-banner";
import { ContentRow } from "@/components/content/content-row";
import { HeroSkeleton, ContentRowSkeleton } from "@/components/ui/skeleton";
import { useContentStore } from "@/store/content-store";
import { useAuthStore } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";
import type { ContentItem } from "@/types";
import { Compass, Film, Tv, Sparkles, TrendingUp, RefreshCw } from "lucide-react";

interface ContentSection {
  title: string;
  items: (ContentItem & { watchProgress?: { progressSeconds: number; totalSeconds: number | null } })[];
  showProgress?: boolean;
  isTop10?: boolean;
}

export default function BrowsePage() {
  const { setFeatured, featured } = useContentStore();
  const { activeProfile } = useAuthStore();
  const { playMicroInteraction } = useThemeStore();

  const [activeTab, setActiveTab] = useState<"all" | "movie" | "series">("all");
  const [continueWatchingItems, setContinueWatchingItems] = useState<any[]>([]);
  const [top10Items, setTop10Items] = useState<ContentItem[]>([]);
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  const [trendingItems, setTrendingItems] = useState<ContentItem[]>([]);
  const [becauseYouWatched, setBecauseYouWatched] = useState<{ contextTitle: string; items: ContentItem[] } | null>(null);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // High-performance single-request home-feed loader
  const loadHomeFeed = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const profileParam = activeProfile?.id ? `profileId=${activeProfile.id}&` : "";
      const feedRes = await fetch(`/api/content/home-feed?${profileParam}tab=${activeTab}`);

      if (feedRes.ok) {
        const data = await feedRes.json();
        if (data.success && data.data) {
          const feed = data.data;

          // 1. Featured Hero
          if (feed.featured?.length > 0) {
            setFeatured(feed.featured);
          }

          // 2. Top 10 & Trending
          if (feed.top10) setTop10Items(feed.top10);
          if (feed.trending) setTrendingItems(feed.trending);

          // 3. Personalization
          if (feed.continueWatching) setContinueWatchingItems(feed.continueWatching);
          if (feed.recommendations) setRecommendations(feed.recommendations);
          if (feed.becauseYouWatched) setBecauseYouWatched(feed.becauseYouWatched);

          // 4. Curated Sections
          const newSections: ContentSection[] = [];
          if (feed.movies?.length > 0) {
            newSections.push({ title: "🎬 Blockbuster Movies", items: feed.movies });
          }
          if (feed.series?.length > 0) {
            newSections.push({ title: "📺 Binge-Worthy TV Series", items: feed.series });
          }
          if (feed.action?.length > 0) {
            newSections.push({ title: "💥 Action & Thrillers", items: feed.action });
          }
          if (feed.sciFi?.length > 0) {
            newSections.push({ title: "🚀 Sci-Fi & Multiverse", items: feed.sciFi });
          }
          if (feed.drama?.length > 0) {
            newSections.push({ title: "🎭 Drama & Mystery", items: feed.drama });
          }

          setSections(newSections);
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
      }

      // Fallback: Individual endpoints if home-feed is ever interrupted
      const [featRes, movRes, serRes] = await Promise.all([
        fetch("/api/content/featured"),
        fetch("/api/content?type=movie&limit=15"),
        fetch("/api/content?type=series&limit=15"),
      ]);

      if (featRes.ok) {
        const fData = await featRes.json();
        if (fData.success) setFeatured(fData.data);
      }
      const movies = movRes.ok ? (await movRes.json()).data?.items || [] : [];
      const series = serRes.ok ? (await serRes.json()).data?.items || [] : [];

      setSections([
        { title: "🎬 Blockbuster Movies", items: movies },
        { title: "📺 Binge-Worthy TV Series", items: series },
      ]);
      setTop10Items([...movies, ...series].slice(0, 10));
    } catch (err) {
      console.error("Browse feed load failure:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeProfile?.id, activeTab, setFeatured]);

  useEffect(() => {
    loadHomeFeed();
  }, [loadHomeFeed]);

  const handleTabChange = (tab: "all" | "movie" | "series") => {
    playMicroInteraction("switch");
    setActiveTab(tab);
  };

  const filteredSections = sections
    .map((sec) => {
      if (activeTab === "movie") {
        const filtered = sec.items.filter((i) => i.type === "movie");
        return filtered.length > 0 ? { ...sec, items: filtered } : null;
      }
      if (activeTab === "series") {
        const filtered = sec.items.filter((i) => i.type === "series");
        return filtered.length > 0 ? { ...sec, items: filtered } : null;
      }
      return sec;
    })
    .filter(Boolean) as ContentSection[];

  const filteredTop10 = top10Items.filter((i) => {
    if (activeTab === "movie") return i.type === "movie";
    if (activeTab === "series") return i.type === "series";
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-600 selection:text-white">
      {/* Cinematic Hero Banner */}
      {isLoading ? (
        <HeroSkeleton />
      ) : (
        <HeroBanner items={featured} />
      )}

      {/* Category Section Switcher */}
      <div className="px-4 sm:px-12 relative z-20 -mt-6 sm:-mt-10 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-zinc-950/80 backdrop-blur-2xl border border-white/10 p-1.5 rounded-2xl w-fit shadow-2xl">
          <button
            data-focusable="true"
            onClick={() => handleTabChange("all")}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Compass size={14} />
            All Content
          </button>
          <button
            data-focusable="true"
            onClick={() => handleTabChange("movie")}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "movie"
                ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Film size={14} />
            Movies
          </button>
          <button
            data-focusable="true"
            onClick={() => handleTabChange("series")}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "series"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Tv size={14} />
            TV Shows
          </button>
        </div>

        {/* Live Cache Refresh Indicator */}
        <button
          data-focusable="true"
          onClick={() => loadHomeFeed(true)}
          disabled={isRefreshing}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition-all hover:bg-white/10"
          title="Refresh Catalog Feed"
        >
          <RefreshCw size={13} className={isRefreshing ? "animate-spin text-red-500" : ""} />
          <span>{isRefreshing ? "Syncing..." : "Sync Feed"}</span>
        </button>
      </div>

      {/* Content Rows */}
      <div className="pb-24 relative z-10 space-y-2">
        {isLoading ? (
          <>
            <ContentRowSkeleton count={6} />
            <ContentRowSkeleton count={6} />
            <ContentRowSkeleton count={6} />
          </>
        ) : (
          <>
            {/* Continue Watching Row (Profile-Specific) */}
            {continueWatchingItems.length > 0 && activeTab === "all" && (
              <ContentRow
                key="row-continue-watching"
                title="⏱️ Continue Watching"
                items={continueWatchingItems}
                showProgress={true}
              />
            )}

            {/* Top 10 Row (Netflix Hallmark Feature) */}
            {filteredTop10.length > 0 && (
              <ContentRow
                key={`row-top10-${activeTab}`}
                title="🏆 Top 10 in Your Country Today"
                items={filteredTop10}
                isTop10={true}
              />
            )}

            {/* Trending Now */}
            {trendingItems.length > 0 && activeTab === "all" && (
              <ContentRow
                key="row-trending-now"
                title="🔥 Trending Now on StreamVault"
                items={trendingItems}
              />
            )}

            {/* AI Recommendations */}
            {recommendations.length > 0 && activeTab === "all" && (
              <ContentRow
                key="row-recommendations"
                title="✨ AI Recommended For You"
                items={recommendations}
              />
            )}

            {/* Contextual "Because You Watched" Row */}
            {becauseYouWatched && becauseYouWatched.items.length > 0 && activeTab === "all" && (
              <ContentRow
                key={`row-byw-${becauseYouWatched.contextTitle}`}
                title={`💡 Because You Watched "${becauseYouWatched.contextTitle}"`}
                items={becauseYouWatched.items}
              />
            )}

            {/* Standard Catalog Rows */}
            {filteredSections.map((section, sIdx) => (
              <ContentRow
                key={`row-section-${section.title}-${sIdx}`}
                title={section.title}
                items={section.items}
                showProgress={section.showProgress}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
