"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home, ShieldAlert, ChevronDown } from "lucide-react";
import { useThemeStore } from "@/store/theme-store";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const { playMicroInteraction } = useThemeStore();

  useEffect(() => {
    console.error("[StreamVault Unhandled App Error]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between relative overflow-hidden selection:bg-red-600 selection:text-white">
      {/* Background ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-red-600/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="px-6 sm:px-12 py-6 relative z-10 flex items-center justify-between">
        <Link href="/browse" className="flex items-center gap-2">
          <span className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
            STREAM<span className="text-white">VAULT</span>
          </span>
        </Link>
      </header>

      {/* Center Error Boundary */}
      <main className="max-w-xl mx-auto px-6 py-12 text-center relative z-10 my-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-20 h-20 rounded-2xl bg-red-950/60 border border-red-500/30 flex items-center justify-center mx-auto mb-6 text-red-500 shadow-2xl shadow-red-900/30"
        >
          <AlertTriangle size={38} className="animate-pulse" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3"
        >
          Playback Interrupted
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-zinc-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed"
        >
          An unexpected glitch occurred while rendering this stream view. Our telemetry service has logged the event and our edge systems are recovering.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-3 mb-8"
        >
          <button
            onClick={() => {
              playMicroInteraction("click");
              reset();
            }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-red-900/40 hover:scale-102 active:scale-98"
          >
            <RefreshCw size={16} /> Try Again
          </button>
          <Link
            href="/browse"
            onClick={() => playMicroInteraction("click")}
            className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold px-5 py-3 rounded-xl border border-white/10 transition-all hover:scale-102"
          >
            <Home size={16} /> Back to Browse
          </Link>
        </motion.div>

        {/* Collapsible Diagnostic Info */}
        <div className="max-w-md mx-auto text-left">
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 mx-auto transition-colors font-medium mb-3"
          >
            <ShieldAlert size={13} />
            Diagnostic Info {error.digest && `(Digest: ${error.digest.slice(0, 8)})`}
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
            />
          </button>

          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-3.5 rounded-xl bg-zinc-950/80 border border-white/10 text-xs font-mono text-zinc-400 overflow-x-auto"
            >
              <p className="text-red-400 font-semibold mb-1">{error.name}: {error.message}</p>
              {error.digest && <p className="text-zinc-500">Digest: {error.digest}</p>}
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-zinc-600 relative z-10">
        System Status: <span className="text-emerald-400 font-mono">Edge CDN Online</span> • Error Code: <span className="text-zinc-400 font-mono">STREAMVAULT_ERR_500</span>
      </footer>
    </div>
  );
}
