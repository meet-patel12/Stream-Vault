"use client";

import { useState, useRef, useCallback, type TouchEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Volume2, Lock, Unlock, RotateCcw, RotateCw } from "lucide-react";
import { clsx } from "clsx";

interface MobileGesturesProps {
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  currentVolume: number;
  isLocked: boolean;
  onToggleLock: () => void;
  brightness: number;
  onBrightnessChange: (brightness: number) => void;
}

export function MobileGestures({
  onSeek,
  onVolumeChange,
  currentVolume,
  isLocked,
  onToggleLock,
  brightness,
  onBrightnessChange,
}: MobileGesturesProps) {
  const [activeRipple, setActiveRipple] = useState<"left" | "right" | null>(null);
  const [touchIndicator, setTouchIndicator] = useState<{
    type: "volume" | "brightness";
    value: number;
  } | null>(null);

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number; initialVal: number; side: "left" | "right" } | null>(null);
  const indicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showIndicator = useCallback((type: "volume" | "brightness", val: number) => {
    setTouchIndicator({ type, value: val });
    if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
    indicatorTimeoutRef.current = setTimeout(() => {
      setTouchIndicator(null);
    }, 1200);
  }, []);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (isLocked) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const width = window.innerWidth;
    const isLeft = touch.clientX < width / 2;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      initialVal: isLeft ? brightness : currentVolume,
      side: isLeft ? "left" : "right",
    };

    // Double-tap detection
    const now = Date.now();
    const timeDiff = now - lastTapRef.current.time;
    const dist = Math.hypot(touch.clientX - lastTapRef.current.x, touch.clientY - lastTapRef.current.y);

    if (timeDiff < 300 && dist < 50) {
      // Double tap recognized!
      if (isLeft) {
        onSeek(-10);
        setActiveRipple("left");
        setTimeout(() => setActiveRipple(null), 600);
      } else {
        onSeek(10);
        setActiveRipple("right");
        setTimeout(() => setActiveRipple(null), 600);
      }
      lastTapRef.current = { time: 0, x: 0, y: 0 };
    } else {
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (isLocked || !touchStartRef.current) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaY = touchStartRef.current.y - touch.clientY; // upward swipe is positive
    const sensitivity = 250; // pixels for 0% to 100%
    const change = deltaY / sensitivity;

    if (touchStartRef.current.side === "left") {
      // Brightness (range 0.3 to 1.5)
      const nextBrightness = Math.max(0.3, Math.min(1.5, touchStartRef.current.initialVal + change));
      onBrightnessChange(nextBrightness);
      showIndicator("brightness", Math.round(((nextBrightness - 0.3) / 1.2) * 100));
    } else {
      // Volume (range 0 to 1)
      const nextVol = Math.max(0, Math.min(1, touchStartRef.current.initialVal + change));
      onVolumeChange(nextVol);
      showIndicator("volume", Math.round(nextVol * 100));
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  return (
    <div
      className="absolute inset-0 z-30 pointer-events-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Screen Lock Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
        className={clsx(
          "absolute top-5 right-5 sm:right-6 z-40 p-3 rounded-full backdrop-blur-xl border transition-all shadow-2xl",
          isLocked
            ? "bg-red-600/90 text-white border-red-400 animate-pulse scale-110"
            : "bg-black/50 text-white/80 border-white/20 hover:text-white"
        )}
        title={isLocked ? "Screen Locked (Tap to Unlock)" : "Lock Screen Controls"}
        aria-label="Toggle screen lock"
      >
        {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
      </button>

      {/* Double-Tap Seek Ripples */}
      <AnimatePresence>
        {activeRipple === "left" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0 }}
            className="absolute left-8 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-md rounded-full p-6 text-white flex flex-col items-center pointer-events-none"
          >
            <RotateCcw size={36} className="animate-spin-once" />
            <span className="font-bold text-sm mt-1">-10s</span>
          </motion.div>
        )}

        {activeRipple === "right" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0 }}
            className="absolute right-8 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-md rounded-full p-6 text-white flex flex-col items-center pointer-events-none"
          >
            <RotateCw size={36} className="animate-spin-once" />
            <span className="font-bold text-sm mt-1">+10s</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vertical Swipe HUD Indicator (Brightness or Volume) */}
      <AnimatePresence>
        {touchIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 text-white flex items-center gap-3 shadow-2xl pointer-events-none"
          >
            {touchIndicator.type === "brightness" ? (
              <Sun size={24} className="text-amber-400" />
            ) : (
              <Volume2 size={24} className="text-red-500" />
            )}
            <div className="w-28 sm:w-36">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="capitalize">{touchIndicator.type}</span>
                <span>{touchIndicator.value}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 rounded-full"
                  style={{ width: `${touchIndicator.value}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
