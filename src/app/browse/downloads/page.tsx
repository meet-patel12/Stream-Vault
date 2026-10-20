"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Download,
  HardDrive,
  Trash2,
  Play,
  Settings,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Film,
  Tv,
  AlertCircle,
  Plus,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { Skeleton } from "@/components/ui/skeleton";

interface DownloadItem {
  id: number;
  contentId: number;
  episodeId: number | null;
  quality: string;
  fileSizeBytes: number;
  status: string;
  expiresAt: string | null;
  downloadedAt: string;
  content: {
    id: number;
    title: string;
    slug: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    type: string;
    duration: number | null;
  } | null;
  episode: {
    id: number;
    title: string;
    episodeNumber: number;
    seasonNumber: number;
  } | null;
}

export default function DownloadsPage() {
  const { activeProfile } = useAuthStore();

  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Settings
  const [autoDownloadNext, setAutoDownloadNext] = useState(true);
  const [autoDeleteWatched, setAutoDeleteWatched] = useState(true);
  const [preferredQuality, setPreferredQuality] = useState<"720p" | "1080p" | "4k">("1080p");
  const [deviceStorageEstimate, setDeviceStorageEstimate] = useState<{
    quota: number;
    usage: number;
  }>({ quota: 100 * 1024 * 1024 * 1024, usage: 15 * 1024 * 1024 * 1024 });

  // Load storage estimation
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        if (est.quota && est.usage) {
          setDeviceStorageEstimate({ quota: est.quota, usage: est.usage });
        }
      });
    }
  }, []);

  const loadDownloads = useCallback(async () => {
    if (!activeProfile) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/downloads?profileId=${activeProfile.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDownloads(data.data.downloads || []);
          setTotalStorageBytes(data.data.totalStorageBytes || 0);
        }
      }
    } catch {
      toast.error("Failed to load downloads");
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  // Trigger Smart Downloads Sync
  const handleSmartSync = async () => {
    if (!activeProfile) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/downloads/smart-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: activeProfile.id,
          autoDeleteWatched,
          autoDownloadNext,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const { deletedCount, queuedNextEpisodes } = data.data;
        if (deletedCount > 0 || queuedNextEpisodes.length > 0) {
          toast.success(
            `Smart Sync: Auto-deleted ${deletedCount} watched, queued ${queuedNextEpisodes.length} next episodes!`
          );
        } else {
          toast("Downloads are up to date", { icon: "✅" });
        }
        loadDownloads();
      }
    } catch {
      toast.error("Smart sync error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/downloads?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Download deleted from device");
        setDownloads((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      toast.error("Error deleting download");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const usedPercent = Math.min(
    100,
    Math.round((totalStorageBytes / (deviceStorageEstimate.quota || 1)) * 100)
  );

  return (
    <div className="min-h-screen bg-black pt-20 sm:pt-24 pb-20 px-4 sm:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Download size={32} className="text-red-500" />
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Downloads & Offline Playback
            </h1>
          </div>
          <p className="text-zinc-400 text-sm">
            Watch anytime, anywhere without an internet connection on your favorite device.
          </p>
        </div>

        <button
          onClick={handleSmartSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition-all border border-white/10 self-start md:self-auto active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Syncing..." : "Run Smart Sync"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Storage Capacity Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive size={20} className="text-blue-400" />
              <h3 className="text-base font-bold text-white">Device Storage</h3>
            </div>
            <span className="text-xs font-semibold text-zinc-400">
              {formatBytes(totalStorageBytes)} Used
            </span>
          </div>

          {/* Storage Meter Bar */}
          <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden flex mb-3">
            <div
              className="h-full bg-red-600 transition-all duration-500 shadow-[0_0_10px_#e50914]"
              style={{ width: `${Math.max(usedPercent, 2)}%` }}
              title="StreamVault Downloads"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
              StreamVault ({formatBytes(totalStorageBytes)})
            </span>
            <span>Device Quota: {formatBytes(deviceStorageEstimate.quota)}</span>
          </div>
        </div>

        {/* Smart Downloads Settings Card */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={20} className="text-yellow-400" />
            <h3 className="text-base font-bold text-white">Smart Downloads Engine</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Auto Delete */}
            <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-white/5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-white mb-1">Auto-Delete Watched</p>
                <p className="text-[11px] text-zinc-400">
                  Automatically frees up space when you finish an episode.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 font-medium">
                  {autoDeleteWatched ? "Active" : "Off"}
                </span>
                <input
                  type="checkbox"
                  checked={autoDeleteWatched}
                  onChange={(e) => setAutoDeleteWatched(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-zinc-700 bg-zinc-900 cursor-pointer"
                />
              </div>
            </div>

            {/* Auto Next Episode */}
            <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-white/5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-white mb-1">Auto-Download Next</p>
                <p className="text-[11px] text-zinc-400">
                  Pre-caches the next episode of your series automatically.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 font-medium">
                  {autoDownloadNext ? "Active" : "Off"}
                </span>
                <input
                  type="checkbox"
                  checked={autoDownloadNext}
                  onChange={(e) => setAutoDownloadNext(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-zinc-700 bg-zinc-900 cursor-pointer"
                />
              </div>
            </div>

            {/* Quality Selector */}
            <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-white/5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-white mb-1">Download Quality</p>
                <p className="text-[11px] text-zinc-400">
                  Determines resolution and storage consumption.
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                {(["720p", "1080p", "4k"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setPreferredQuality(q)}
                    className={clsx(
                      "flex-1 py-1 rounded text-[11px] font-bold uppercase transition-all",
                      preferredQuality === q
                        ? "bg-red-600 text-white shadow"
                        : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Downloads List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Available on this device ({downloads.length})
          </h2>
          <Link
            href="/browse"
            className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
          >
            <Plus size={14} /> Find more to download
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : downloads.length === 0 ? (
          <div className="text-center py-20 bg-zinc-950/40 rounded-3xl border border-white/5">
            <Download size={44} className="mx-auto mb-3 text-zinc-600" />
            <h3 className="text-xl font-bold text-white mb-1">No Downloads Yet</h3>
            <p className="text-zinc-400 text-sm max-w-md mx-auto mb-6">
              Never miss a moment of your favorite movies and shows, even when you&apos;re in airplane mode or away from Wi-Fi.
            </p>
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-red-900/30"
            >
              Browse Content
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {downloads.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-800/80 border border-white/5 transition-all group"
              >
                {/* Poster / Backdrop */}
                <div className="w-24 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 relative">
                  {d.content?.backdropUrl || d.content?.posterUrl ? (
                    <img
                      src={d.content.backdropUrl || d.content.posterUrl || ""}
                      alt={d.content.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film size={20} className="text-zinc-600" />
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/80 text-[8px] font-black px-1 rounded text-white uppercase">
                    {d.quality}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-sm font-bold truncate group-hover:text-red-400 transition-colors">
                    {d.content?.title || "Untitled Content"}
                  </h4>
                  {d.episode ? (
                    <p className="text-xs text-zinc-400 truncate">
                      S{d.episode.seasonNumber}:E{d.episode.episodeNumber} &ldquo;{d.episode.title}&rdquo;
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">
                      {d.content?.duration ? `${d.content.duration} min • Movie` : "Feature Film"}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1">
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 size={11} /> Ready to Watch
                    </span>
                    <span>•</span>
                    <span>{formatBytes(Number(d.fileSizeBytes || 0))}</span>
                    <span>•</span>
                    <span>30 days remaining</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {d.content?.slug && (
                    <Link
                      href={`/browse/watch/${d.content.slug}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all shadow active:scale-95"
                    >
                      <Play size={13} fill="currentColor" /> Play Offline
                    </Link>
                  )}

                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/30 transition-all"
                    title="Delete download"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
