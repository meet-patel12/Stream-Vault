"use client";

import {
  useRef,
  useState,
  useCallback,
  useMemo,
  type MouseEvent,
  type TouchEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";

interface Chapter {
  title: string;
  startTime: number;
}

interface SmartTimelineProps {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  chapters?: Chapter[];
  resumeTime?: number;
  creditsStartTime?: number;
  thumbnailUrl?: string;
  onSeek: (time: number) => void;
  formatTime: (secs: number) => string;
}

export function SmartTimeline({
  currentTime,
  duration,
  bufferedEnd,
  chapters = [],
  resumeTime = 0,
  creditsStartTime,
  thumbnailUrl,
  onSeek,
  formatTime,
}: SmartTimelineProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const resumePercent = duration > 0 && resumeTime > 0 ? (resumeTime / duration) * 100 : 0;
  const creditsPercent = duration > 0 && creditsStartTime ? (creditsStartTime / duration) * 100 : 0;

  // Active chapter under hover or current playback
  const activeHoverChapter = useMemo(() => {
    if (hoverTime === null || chapters.length === 0) return null;
    let found: Chapter | null = null;
    for (let i = 0; i < chapters.length; i++) {
      if (hoverTime >= chapters[i].startTime) {
        found = chapters[i];
      } else {
        break;
      }
    }
    return found;
  }, [hoverTime, chapters]);

  const calculateTimeFromEvent = useCallback(
    (clientX: number): { time: number; percent: number } => {
      const bar = progressBarRef.current;
      if (!bar || duration <= 0) return { time: 0, percent: 0 };
      const rect = bar.getBoundingClientRect();
      const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = clampedX / rect.width;
      return {
        time: ratio * duration,
        percent: ratio * 100,
      };
    },
    [duration]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const { time, percent } = calculateTimeFromEvent(e.clientX);
      setHoverTime(time);
      setHoverPosition(percent);
      if (isDragging) {
        onSeek(time);
      }
    },
    [calculateTimeFromEvent, isDragging, onSeek]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setHoverTime(null);
    }
  }, [isDragging]);

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      const { time } = calculateTimeFromEvent(e.clientX);
      onSeek(time);
    },
    [calculateTimeFromEvent, onSeek]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (e.touches.length > 0) {
        const { time, percent } = calculateTimeFromEvent(e.touches[0].clientX);
        setHoverTime(time);
        setHoverPosition(percent);
        onSeek(time);
      }
    },
    [calculateTimeFromEvent, onSeek]
  );

  return (
    <div
      className="relative w-full py-3 cursor-pointer select-none group/timeline"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setHoverTime(null)}
      role="slider"
      aria-label="Video scrubber"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration)}
      aria-valuenow={Math.floor(currentTime)}
      aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      tabIndex={0}
    >
      {/* Hover Preview Tooltip Card */}
      <AnimatePresence>
        {hoverTime !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-3 pointer-events-none -translate-x-1/2 flex flex-col items-center z-50"
            style={{
              left: `${Math.max(8, Math.min(92, hoverPosition))}%`,
            }}
          >
            <div className="bg-zinc-950/95 border border-white/20 rounded-xl shadow-2xl p-2 backdrop-blur-xl flex flex-col items-center">
              {/* Thumbnail Scrubbing Preview (Simulated or Real poster/thumbnail) */}
              <div className="w-36 sm:w-44 aspect-video bg-zinc-900 rounded-lg overflow-hidden relative border border-white/10 mb-1.5 flex items-center justify-center">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt="Scrub thumbnail preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
                    <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                      StreamVault Preview
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20" />
                <span className="absolute bottom-1 right-1.5 bg-black/85 text-white text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border border-white/10">
                  {formatTime(hoverTime)}
                </span>
              </div>

              {/* Chapter Tag if applicable */}
              {activeHoverChapter && (
                <span className="text-[11px] font-semibold text-red-400 text-center max-w-[170px] truncate px-1">
                  📌 {activeHoverChapter.title}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar Track */}
      <div
        ref={progressBarRef}
        className="relative w-full h-1.5 sm:h-2 bg-white/25 group-hover/timeline:h-2.5 rounded-full overflow-visible transition-all duration-200"
      >
        {/* Buffered Range Progress */}
        <div
          className="absolute left-0 top-0 h-full bg-white/35 rounded-full transition-all duration-300"
          style={{ width: `${bufferedPercent}%` }}
        />

        {/* Hover Scrub Fill */}
        {hoverPosition > 0 && (
          <div
            className="absolute left-0 top-0 h-full bg-white/40 rounded-full pointer-events-none"
            style={{ width: `${hoverPosition}%` }}
          />
        )}

        {/* Active Played Progress */}
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-700 via-red-600 to-red-500 rounded-full transition-all duration-75 shadow-[0_0_12px_rgba(229,9,20,0.7)]"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Chapter Marker Ticks */}
        {chapters.map((ch, idx) => {
          if (!duration || ch.startTime <= 0 || ch.startTime >= duration) return null;
          const tickPercent = (ch.startTime / duration) * 100;
          return (
            <div
              key={idx}
              className="absolute top-0 bottom-0 w-1 bg-black/90 z-10 border-l border-white/40"
              style={{ left: `${tickPercent}%` }}
              title={ch.title}
            />
          );
        })}

        {/* Resume Pin Marker */}
        {resumePercent > 0 && resumePercent < 95 && (
          <div
            className="absolute -top-1 w-1.5 h-3.5 bg-amber-400 rounded-full z-20 shadow-md group-hover/timeline:h-4.5 transition-all"
            style={{ left: `${resumePercent}%` }}
            title={`Resume Marker: ${formatTime(resumeTime)}`}
          />
        )}

        {/* Credits / Next Episode Marker */}
        {creditsPercent > 0 && creditsPercent < 99 && (
          <div
            className="absolute -top-1 w-1 h-3.5 bg-blue-400 rounded-full z-20 shadow-md group-hover/timeline:h-4.5 transition-all"
            style={{ left: `${creditsPercent}%` }}
            title="Credits Start / Next Episode"
          />
        )}

        {/* Playhead Scrub Knob (Thumb) */}
        <div
          className={clsx(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-[0_0_10px_rgba(229,9,20,0.9)] transition-transform duration-150 z-30",
            hoverTime !== null || isDragging
              ? "scale-125 opacity-100"
              : "scale-0 group-hover/timeline:scale-100 opacity-0 group-hover/timeline:opacity-100"
          )}
          style={{
            left: `${progressPercent}%`,
            transform: `translateX(-50%) translateY(-50%)`,
          }}
        />
      </div>
    </div>
  );
}
