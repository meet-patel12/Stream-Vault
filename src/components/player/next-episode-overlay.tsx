"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, X, Film } from "lucide-react";

interface NextEpisodeOverlayProps {
  nextEpisodeTitle?: string;
  nextEpisodeSubtitle?: string;
  nextEpisodeThumbnail?: string;
  countdownSeconds?: number;
  onPlayNext: () => void;
  onCancel: () => void;
}

export function NextEpisodeOverlay({
  nextEpisodeTitle = "Next Episode",
  nextEpisodeSubtitle = "Starting shortly",
  nextEpisodeThumbnail,
  countdownSeconds = 10,
  onPlayNext,
  onCancel,
}: NextEpisodeOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onPlayNext();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onPlayNext]);

  const progressPercent = ((countdownSeconds - secondsLeft) / countdownSeconds) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.95 }}
      className="absolute bottom-24 right-6 z-50 bg-zinc-950/95 border border-white/20 rounded-2xl p-4 sm:p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.9)] max-w-sm sm:max-w-md w-full backdrop-blur-2xl pointer-events-auto"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase font-extrabold tracking-wider text-red-500">
          Up Next in {secondsLeft}s
        </span>
        <button
          onClick={onCancel}
          className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          title="Watch Credits"
        >
          <X size={16} />
        </button>
      </div>

      {/* Episode Thumbnail + Info */}
      <div className="flex gap-3.5 mb-4">
        <div className="w-28 sm:w-32 aspect-video bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative border border-white/10">
          {nextEpisodeThumbnail ? (
            <img
              src={nextEpisodeThumbnail}
              alt={nextEpisodeTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
              <Film size={24} className="text-zinc-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <Play size={18} fill="white" className="text-white ml-0.5" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-400 font-semibold mb-0.5">{nextEpisodeSubtitle}</p>
          <h4 className="text-sm font-bold text-white truncate">{nextEpisodeTitle}</h4>
          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
            The story continues directly in the next installment.
          </p>
        </div>
      </div>

      {/* Countdown Progress Bar */}
      <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mb-3.5">
        <div
          className="h-full bg-red-600 transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPlayNext}
          className="flex-1 bg-white hover:bg-zinc-200 text-black font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
        >
          <Play size={16} fill="black" />
          <span>Play Now</span>
        </button>
        <button
          onClick={onCancel}
          className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-all border border-white/10"
        >
          Watch Credits
        </button>
      </div>
    </motion.div>
  );
}
