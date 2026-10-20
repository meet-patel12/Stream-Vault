"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ContentCard } from "@/components/content/content-card";
import { useContentStore } from "@/store/content-store";
import { useAuthStore } from "@/store/auth-store";
import type { ContentItem } from "@/types";
import { EmptyState } from "@/components/ui/empty-state";
import { useThemeStore } from "@/store/theme-store";
import {
  BookmarkCheck,
  Plus,
  Heart,
  Clock,
  FolderPlus,
  Share2,
  Trash2,
  Globe,
  Lock,
  Layers,
  Check,
  Copy,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { clsx } from "clsx";

interface CustomPlaylist {
  id: number;
  name: string;
  description: string | null;
  type: string;
  isPublic: boolean;
  shareToken: string | null;
  itemCount: number;
  createdAt: string;
}

export default function MyListPage() {
  const { myList, setMyList } = useContentStore();
  const { activeProfile } = useAuthStore();
  const { playMicroInteraction } = useThemeStore();

  const [activeTab, setActiveTab] = useState<"watchlist" | "favorites" | "watch_later" | "collections">("watchlist");
  const [playlists, setPlaylists] = useState<CustomPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<CustomPlaylist | null>(null);
  const [playlistContent, setPlaylistContent] = useState<ContentItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Drag-and-drop Reordering State
  const [isReordering, setIsReordering] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleMoveItem = (idx: number, direction: "up" | "down") => {
    playMicroInteraction("switch");
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= myList.length) return;

    const updated = [...myList];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setMyList(updated);
    toast.success("Watchlist order updated", { icon: "↕️" });
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData("text/plain", idx.toString());
    setDraggedIdx(idx);
    playMicroInteraction("click");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const updated = [...myList];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setMyList(updated);
    setDraggedIdx(null);
    playMicroInteraction("success");
    toast.success("Item repositioned", { icon: "✨" });
  };

  // New Playlist Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"custom" | "collection">("custom");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load playlists for active profile
  const loadPlaylists = useCallback(async () => {
    if (!activeProfile) return;
    try {
      const res = await fetch(`/api/playlists?profileId=${activeProfile.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.playlists) {
          setPlaylists(data.data.playlists);
        }
      }
    } catch {
      // Ignore
    }
  }, [activeProfile]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Load content when a custom playlist is selected
  const loadPlaylistDetails = useCallback(async (playlistId: number) => {
    setIsLoadingItems(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPlaylistContent(data.data.items || []);
        }
      }
    } catch {
      toast.error("Failed to load playlist items");
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPlaylist) {
      loadPlaylistDetails(selectedPlaylist.id);
    }
  }, [selectedPlaylist, loadPlaylistDetails]);

  // Create playlist
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !newName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: activeProfile.id,
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          type: newType,
          isPublic: newIsPublic,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Created "${data.data.name}"`);
        setShowNewModal(false);
        setNewName("");
        setNewDesc("");
        loadPlaylists();
      } else {
        toast.error(data.error?.message || "Failed to create playlist");
      }
    } catch {
      toast.error("Error creating playlist");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete playlist
  const handleDeletePlaylist = async (id: number) => {
    if (!confirm("Are you sure you want to delete this playlist?")) return;
    try {
      const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Playlist deleted");
        if (selectedPlaylist?.id === id) {
          setSelectedPlaylist(null);
          setPlaylistContent([]);
        }
        loadPlaylists();
      }
    } catch {
      toast.error("Failed to delete playlist");
    }
  };

  // Copy share link
  const handleCopyShareLink = (shareToken: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/playlist/shared/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Public share link copied to clipboard!", { icon: "🔗" });
  };

  return (
    <div className="min-h-screen bg-black pt-20 sm:pt-24 pb-20 px-4 sm:px-8">
      {/* Header and Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BookmarkCheck size={32} className="text-red-500" />
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              My Library & Collections
            </h1>
          </div>
          <p className="text-zinc-400 text-sm">
            Curated watchlists, favorites, and custom playlists for{" "}
            <span className="text-white font-semibold">{activeProfile?.name || "your profile"}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {activeTab === "watchlist" && myList.length > 1 && (
            <button
              onClick={() => {
                playMicroInteraction("click");
                setIsReordering((v) => !v);
              }}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border",
                isReordering
                  ? "bg-red-600/25 text-red-400 border-red-500/40 shadow-lg shadow-red-950/40"
                  : "bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/25 hover:text-white"
              )}
            >
              <GripVertical size={14} />
              {isReordering ? "Done Reordering" : "Reorder Library"}
            </button>
          )}

          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-red-900/30 active:scale-95 text-xs sm:text-sm"
          >
            <FolderPlus size={16} />
            New Playlist / Collection
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-8 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab("watchlist");
            setSelectedPlaylist(null);
          }}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "watchlist" && !selectedPlaylist
              ? "bg-white text-black shadow-lg"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          )}
        >
          <BookmarkCheck size={16} />
          Watchlist ({myList.length})
        </button>

        <button
          onClick={() => {
            setActiveTab("favorites");
            setSelectedPlaylist(null);
          }}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "favorites" && !selectedPlaylist
              ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Heart size={16} />
          Favorites
        </button>

        <button
          onClick={() => {
            setActiveTab("watch_later");
            setSelectedPlaylist(null);
          }}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "watch_later" && !selectedPlaylist
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Clock size={16} />
          Watch Later
        </button>

        <button
          onClick={() => {
            setActiveTab("collections");
            setSelectedPlaylist(null);
          }}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "collections"
              ? "bg-zinc-800 text-white border border-white/20"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Layers size={16} />
          Custom Playlists ({playlists.length})
        </button>
      </div>

      {/* Selected Custom Playlist View */}
      {selectedPlaylist ? (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-white/10 mb-8 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedPlaylist(null)}
                  className="text-xs text-zinc-400 hover:text-white underline mb-1"
                >
                  ← Back to Playlists
                </button>
              </div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                {selectedPlaylist.name}
                {selectedPlaylist.isPublic ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center gap-1 font-semibold">
                    <Globe size={11} /> Public
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1 font-semibold">
                    <Lock size={11} /> Private
                  </span>
                )}
              </h2>
              {selectedPlaylist.description && (
                <p className="text-zinc-400 text-sm mt-1">{selectedPlaylist.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedPlaylist.isPublic && selectedPlaylist.shareToken && (
                <button
                  onClick={() => handleCopyShareLink(selectedPlaylist.shareToken!)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold border border-white/10 transition-all"
                >
                  <Share2 size={14} /> Share Link
                </button>
              )}

              <button
                onClick={() => handleDeletePlaylist(selectedPlaylist.id)}
                className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-400 hover:text-red-300 border border-red-800/40 transition-all"
                title="Delete Playlist"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {isLoadingItems ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="aspect-[16/10] bg-zinc-900 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : playlistContent.length === 0 ? (
            <div className="text-center py-20 bg-zinc-950/50 rounded-2xl border border-white/5">
              <Layers size={40} className="mx-auto mb-3 text-zinc-600" />
              <h3 className="text-xl font-bold text-white mb-1">Playlist is empty</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Add titles from any movie or series page to build this collection.
              </p>
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all"
              >
                Browse Titles
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {playlistContent.map((item) => (
                <ContentCard key={item.id} item={item} size="sm" />
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "collections" ? (
        /* Custom Playlists Overview */
        <div>
          {playlists.length === 0 ? (
            <div className="text-center py-20 bg-zinc-950/50 rounded-2xl border border-white/5">
              <FolderPlus size={44} className="mx-auto mb-3 text-zinc-600" />
              <h3 className="text-xl font-bold text-white mb-1">No Custom Playlists Yet</h3>
              <p className="text-zinc-400 text-sm max-w-md mx-auto mb-6">
                Create themed playlists, weekend binge marathons, or custom watch lists to share with friends.
              </p>
              <button
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm"
              >
                <Plus size={16} /> Create Your First Playlist
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => setSelectedPlaylist(pl)}
                  className="p-5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-800/90 border border-white/5 hover:border-white/20 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/10 text-zinc-300 uppercase">
                        {pl.type}
                      </span>
                      {pl.isPublic ? (
                        <span title="Public">
                          <Globe size={14} className="text-emerald-400" />
                        </span>
                      ) : (
                        <span title="Private">
                          <Lock size={14} className="text-zinc-500" />
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                      {pl.name}
                    </h3>
                    {pl.description && (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{pl.description}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-3 border-t border-white/5 text-xs text-zinc-500">
                    <span>{pl.itemCount} items</span>
                    <span className="text-red-400 font-semibold group-hover:translate-x-1 transition-transform">
                      View →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Standard Watchlist / Favorites / Watch Later Grid */
        <div>
          {myList.length === 0 ? (
            <EmptyState
              icon={BookmarkCheck}
              badge={`Your ${activeTab.replace("_", " ")}`}
              title="Your Collection is Empty"
              description="Start saving movies and shows to watch later by clicking the + button on any title in the StreamVault catalog."
              actionText="Explore Catalog"
              actionHref="/browse"
            />
          ) : (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
              {myList.map((item, idx) => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  draggable={isReordering}
                  onDragStart={(e) => handleDragStart(e as any, idx)}
                  onDragOver={handleDragOver as any}
                  onDrop={(e) => handleDrop(e as any, idx)}
                  className={clsx(
                    "relative group/drag rounded-xl transition-all",
                    isReordering && "ring-2 ring-red-500/50 cursor-grab active:cursor-grabbing hover:scale-102"
                  )}
                >
                  {/* Reordering Controls Overlay */}
                  {isReordering && (
                    <div className="absolute top-2 right-2 z-30 flex items-center gap-1 bg-black/85 backdrop-blur-md p-1 rounded-lg border border-white/20 shadow-xl">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveItem(idx, "up");
                        }}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-white/20 disabled:opacity-30 text-white transition-colors"
                        title="Move Earlier"
                      >
                        <ArrowLeft size={13} />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-red-400 px-1">
                        #{idx + 1}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveItem(idx, "down");
                        }}
                        disabled={idx === myList.length - 1}
                        className="p-1 rounded hover:bg-white/20 disabled:opacity-30 text-white transition-colors"
                        title="Move Later"
                      >
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  <ContentCard item={item} size="sm" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* New Playlist Modal */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative"
            >
              <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <FolderPlus size={22} className="text-red-500" />
                Create New Playlist
              </h3>
              <p className="text-xs text-zinc-400 mb-5">
                Organize your favorite movies and shows into custom shareable lists.
              </p>

              <form onSubmit={handleCreatePlaylist} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Playlist Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Weekend Sci-Fi Marathon"
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Brief description of this collection..."
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 border border-white/5">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className={newIsPublic ? "text-emerald-400" : "text-zinc-500"} />
                    <div>
                      <p className="text-xs font-semibold text-white">Public Shareable Link</p>
                      <p className="text-[11px] text-zinc-400">
                        Anyone with the link can view this playlist
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newIsPublic}
                    onChange={(e) => setNewIsPublic(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-zinc-700 bg-zinc-900 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newName.trim()}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-lg shadow-red-900/40"
                  >
                    {isSubmitting ? "Creating..." : "Create Playlist"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
