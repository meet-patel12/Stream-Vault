"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw, X } from "lucide-react";

interface ResumePromptModalProps {
  resumeTime: number;
  formatTime: (secs: number) => string;
  onResume: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

export function ResumePromptModal({
  resumeTime,
  formatTime,
  onResume,
  onRestart,
  onDismiss,
}: ResumePromptModalProps) {
  // Auto-dismiss after 8 seconds if user doesn't make an explicit choice
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-zinc-950/90 border border-white/20 rounded-2xl p-4 sm:p-5 text-white shadow-2xl backdrop-blur-2xl max-w-sm sm:max-w-md w-[92%] pointer-events-auto"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-sm sm:text-base flex items-center gap-2">
          <span>⏱️ Resume Watching?</span>
        </h4>
        <button
          onClick={onDismiss}
          className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-zinc-300 mb-4">
        You previously left off at <strong className="text-white font-mono">{formatTime(resumeTime)}</strong>. Would you like to resume or restart from the beginning?
      </p>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onResume}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
        >
          <Play size={16} fill="white" />
          <span>Resume from {formatTime(resumeTime)}</span>
        </button>
        <button
          onClick={onRestart}
          className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 px-3 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-all border border-white/10"
        >
          <RotateCcw size={14} />
          <span>Restart</span>
        </button>
      </div>
    </motion.div>
  );
}
