"use client";

import { useEffect, useState, useCallback } from "react";
import { useThemeStore } from "@/store/theme-store";
import { Tv, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function SpatialNavigationController() {
  const { tvMode, toggleTvMode, playMicroInteraction } = useThemeStore();
  const [showNotification, setShowNotification] = useState(false);

  // Toggle TV mode notification
  const handleToggle = useCallback(() => {
    toggleTvMode();
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  }, [toggleTvMode]);

  useEffect(() => {
    let activeFocusIndex = -1;

    const getFocusables = (): HTMLElement[] => {
      return Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-focusable="true"], button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInputActive = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      // 'T' key toggles TV 10-foot mode when not typing in an input
      if ((e.key === "t" || e.key === "T") && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleToggle();
        return;
      }

      // If TV Mode is active or arrow keys used for 10-foot spatial navigation
      if (tvMode && !isInputActive) {
        const focusables = getFocusables();
        if (focusables.length === 0) return;

        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          activeFocusIndex = (activeFocusIndex + 1) % focusables.length;
          focusables[activeFocusIndex].focus();
          focusables[activeFocusIndex].scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          playMicroInteraction("navigate");
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          activeFocusIndex = (activeFocusIndex - 1 + focusables.length) % focusables.length;
          focusables[activeFocusIndex].focus();
          focusables[activeFocusIndex].scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          playMicroInteraction("navigate");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tvMode, handleToggle, playMicroInteraction]);

  return (
    <AnimatePresence>
      {showNotification && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full bg-zinc-950/90 text-white border border-white/20 shadow-2xl backdrop-blur-xl flex items-center gap-2.5 text-xs font-bold"
        >
          <Tv size={16} className={tvMode ? "text-red-500 animate-pulse" : "text-zinc-400"} />
          <span>{tvMode ? "10-Foot TV Mode: ACTIVATED" : "Standard Web Mode: ACTIVATED"}</span>
          <span className="text-[10px] text-zinc-400 font-normal border-l border-white/20 pl-2">
            Press &apos;T&apos; to toggle
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
