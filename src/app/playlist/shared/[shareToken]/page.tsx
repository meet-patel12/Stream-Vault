"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ContentCard } from "@/components/content/content-card";
import type { ContentItem } from "@/types";
import { Layers, Globe, Play, Film, Tv } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

interface SharedPlaylistData {
  id: number;
  name: string;
  description: string | null;
  type: string;
  shareToken: string;
  createdAt: string;
  curator: {
    name: string;
    avatarUrl: string | null;
  } | null;
}

export default function SharedPlaylistPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = use(params);
  const [playlist, setPlaylist] = useState<SharedPlaylistData | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSharedPlaylist = async () => {
      try {
        const res = await fetch(`/api/playlists/shared/${shareToken}`);
        const data = await res.json();
        if (data.success && data.data?.playlist) {
          setPlaylist(data.data.playlist);
          setItems(data.data.items || []);
        } else {
          setError(data.error?.message || "Playlist not found or is private.");
        }
      } catch {
        setError("Failed to load shared playlist.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSharedPlaylist();
  }, [shareToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black pt-24 px-4 sm:px-8">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-5 w-96 mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[16/10] bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center">
        <Layers size={48} className="text-zinc-600 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Playlist Unavailable</h1>
        <p className="text-zinc-400 max-w-sm mb-6 text-sm">{error}</p>
        <Link
          href="/browse"
          className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all"
        >
          Explore StreamVault
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-20 sm:pt-24 pb-20 px-4 sm:px-8">
      {/* Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-red-950/30 border border-white/10 mb-10 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-2">
          <Globe size={14} /> Shared Public Playlist
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-2">
          {playlist.name}
        </h1>
        {playlist.description && (
          <p className="text-zinc-300 text-sm sm:text-base max-w-2xl mb-4">
            {playlist.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-zinc-400 pt-2 border-t border-white/5">
          {playlist.curator && (
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center">
                {playlist.curator.name[0]}
              </span>
              <span>Curated by <strong className="text-white">{playlist.curator.name}</strong></span>
            </div>
          )}
          <span>•</span>
          <span>{items.length} title{items.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Content Grid */}
      {items.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p>This playlist currently contains no items.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
