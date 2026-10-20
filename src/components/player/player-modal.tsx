"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VideoPlayer } from "./video-player";
import { useContentStore } from "@/store/content-store";
import { useAuthStore } from "@/store/auth-store";

export function PlayerModal() {
  const {
    isPlayerOpen,
    playerVideoUrl,
    playerTitle,
    playerStartTime,
    playerVideoKey,
    closePlayer,
    currentContent,
    updateWatchProgress,
  } = useContentStore();
  const { activeProfile } = useAuthStore();
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTime = useRef(0);

  // Lock body scroll when player is open
  useEffect(() => {
    if (isPlayerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPlayerOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePlayer();
    };
    if (isPlayerOpen) {
      document.addEventListener("keydown", handleKey);
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [isPlayerOpen, closePlayer]);

  const handleProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!activeProfile || !currentContent) return;
      if (Math.abs(currentTime - lastSavedTime.current) < 10) return;

      lastSavedTime.current = currentTime;

      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
      progressSaveTimer.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/watch/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileId: activeProfile.id,
              contentId: currentContent.id,
              progressSeconds: Math.floor(currentTime),
              totalSeconds: Math.floor(duration),
            }),
          });
          if (res.ok) {
            updateWatchProgress({
              id: 0,
              profileId: activeProfile.id,
              contentId: currentContent.id,
              episodeId: null,
              progressSeconds: Math.floor(currentTime),
              totalSeconds: Math.floor(duration),
              completed: duration > 0 && currentTime / duration > 0.9,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch {
          // Fail silently
        }
      }, 5000);
    },
    [activeProfile, currentContent, updateWatchProgress]
  );

  return (
    <AnimatePresence>
      {isPlayerOpen && playerVideoUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black flex flex-col"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full h-full"
          >
            <VideoPlayer
              src={playerVideoUrl}
              title={playerTitle ?? ""}
              onClose={closePlayer}
              startTime={playerStartTime}
              onProgress={handleProgress}
              contentId={currentContent?.id}
              profileId={activeProfile?.id}
              introStartTime={currentContent?.introStartTime ?? undefined}
              introEndTime={currentContent?.introEndTime ?? undefined}
              creditsStartTime={currentContent?.creditsStartTime ?? undefined}
              chapters={currentContent?.chapters ?? undefined}
              thumbnailUrl={currentContent?.backdropUrl || currentContent?.posterUrl || undefined}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
