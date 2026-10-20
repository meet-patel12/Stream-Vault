"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Film, Home, Search, Tv, BookmarkCheck, ArrowLeft, Compass } from "lucide-react";
import { useThemeStore } from "@/store/theme-store";

export default function NotFoundPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { playMicroInteraction } = useThemeStore();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      playMicroInteraction("click");
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between relative overflow-hidden selection:bg-red-600 selection:text-white">
      {/* Background cinematic glow gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navbar Brand */}
      <header className="px-6 sm:px-12 py-6 relative z-10 flex items-center justify-between">
        <Link href="/browse" className="flex items-center gap-2">
          <span className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
            STREAM<span className="text-white">VAULT</span>
          </span>
        </Link>
        <Link
          href="/browse"
          className="text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft size={16} /> Return to Browse
        </Link>
      </header>

      {/* Center 404 Visual Experience */}
      <main className="max-w-2xl mx-auto px-6 py-12 text-center relative z-10 my-auto">
        {/* Animated Big 404 with Film Reel Silhouette */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative inline-block mb-6 select-none"
        >
          <div className="text-[120px] sm:text-[180px] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-700 drop-shadow-[0_10px_35px_rgba(229,9,20,0.3)]">
            404
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/20 backdrop-blur-md shadow-2xl">
            <Film size={36} className="text-red-500 animate-spin" style={{ animationDuration: "12s" }} />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3"
        >
          Lost in the Multiverse?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="text-zinc-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed"
        >
          We searched across all dimensions, but that title or page cannot be found. Don&apos;t worry, there is an entire universe of entertainment waiting for you.
        </motion.p>

        {/* Search Quick Bar */}
        <motion.form
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          onSubmit={handleSearchSubmit}
          className="max-w-md mx-auto mb-10 relative"
        >
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-zinc-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search titles, actors, or genres..."
              className="w-full bg-zinc-900/90 border border-white/15 focus:border-red-500 text-white text-sm rounded-2xl pl-11 pr-24 py-3.5 outline-none transition-all shadow-xl"
            />
            <button
              type="submit"
              className="absolute right-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-md"
            >
              Search
            </button>
          </div>
        </motion.form>

        {/* Quick Portal Navigation Links */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/browse"
            onClick={() => playMicroInteraction("click")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all shadow-lg hover:scale-103"
          >
            <Home size={16} /> Home Feed
          </Link>
          <Link
            href="/browse/movies"
            onClick={() => playMicroInteraction("click")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold border border-white/10 transition-all"
          >
            <Film size={16} className="text-red-400" /> Movies
          </Link>
          <Link
            href="/browse/series"
            onClick={() => playMicroInteraction("click")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold border border-white/10 transition-all"
          >
            <Tv size={16} className="text-blue-400" /> TV Shows
          </Link>
          <Link
            href="/browse/my-list"
            onClick={() => playMicroInteraction("click")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold border border-white/10 transition-all"
          >
            <BookmarkCheck size={16} className="text-yellow-400" /> My Library
          </Link>
        </motion.div>
      </main>

      {/* Footer code & watermark */}
      <footer className="px-6 py-6 text-center text-xs text-zinc-600 relative z-10">
        Error Code: <span className="text-zinc-400 font-mono">STREAMVAULT_ERR_404_PAGE_NOT_FOUND</span>
      </footer>
    </div>
  );
}
