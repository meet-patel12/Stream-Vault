"use client";

import { motion } from "framer-motion";
import { LucideIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import { useThemeStore } from "@/store/theme-store";

interface EmptyStateProps {
  icon: LucideIcon;
  badge?: string;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryText?: string;
  secondaryHref?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  badge = "Nothing Here Yet",
  title,
  description,
  actionText,
  actionHref,
  onAction,
  secondaryText,
  secondaryHref,
  onSecondaryAction,
}: EmptyStateProps) {
  const { playMicroInteraction } = useThemeStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="text-center py-20 px-6 max-w-xl mx-auto rounded-3xl bg-zinc-950/60 dark:bg-zinc-950/60 light:bg-white/90 border border-white/10 dark:border-white/10 light:border-slate-200/80 shadow-2xl backdrop-blur-xl relative overflow-hidden"
    >
      {/* Decorative background glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />

      {/* Icon Badge */}
      <div className="relative inline-flex items-center justify-center mb-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/15 flex items-center justify-center text-white shadow-xl shadow-black/50 group">
          <Icon size={36} className="text-red-500 transition-transform duration-300 group-hover:scale-110" />
        </div>
        <span className="absolute -bottom-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-600 text-white shadow-md flex items-center gap-1">
          <Sparkles size={10} /> {badge}
        </span>
      </div>

      {/* Content */}
      <h3 className="text-2xl sm:text-3xl font-black text-white dark:text-white light:text-slate-900 tracking-tight mt-3 mb-2">
        {title}
      </h3>
      <p className="text-sm text-zinc-400 dark:text-zinc-400 light:text-slate-600 max-w-md mx-auto leading-relaxed mb-8">
        {description}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {actionText && (
          actionHref ? (
            <Link
              href={actionHref}
              onClick={() => playMicroInteraction("click")}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-red-900/40 hover:scale-102 active:scale-98"
            >
              {actionText}
            </Link>
          ) : (
            <button
              onClick={() => {
                playMicroInteraction("click");
                onAction?.();
              }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-red-900/40 hover:scale-102 active:scale-98"
            >
              {actionText}
            </button>
          )
        )}

        {secondaryText && (
          secondaryHref ? (
            <Link
              href={secondaryHref}
              onClick={() => playMicroInteraction("click")}
              className="inline-flex items-center gap-2 bg-zinc-800/80 hover:bg-zinc-700 text-white font-semibold text-sm px-5 py-3 rounded-xl border border-white/10 transition-all hover:scale-102"
            >
              {secondaryText}
            </Link>
          ) : (
            <button
              onClick={() => {
                playMicroInteraction("click");
                onSecondaryAction?.();
              }}
              className="inline-flex items-center gap-2 bg-zinc-800/80 hover:bg-zinc-700 text-white font-semibold text-sm px-5 py-3 rounded-xl border border-white/10 transition-all hover:scale-102"
            >
              {secondaryText}
            </button>
          )
        )}
      </div>
    </motion.div>
  );
}
