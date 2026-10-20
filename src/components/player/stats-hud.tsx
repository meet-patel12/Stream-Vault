"use client";

import { motion } from "framer-motion";
import { Activity, X, ShieldCheck } from "lucide-react";

export interface PlaybackStats {
  resolution: string;
  viewport: string;
  bitrateMbps: string;
  bufferHealthSec: number;
  droppedFrames: number;
  totalFrames: number;
  fps: number;
  playerEngine: string;
  audioCodec: string;
  videoCodec: string;
  latencyMs: number;
  audioNormalized: boolean;
  sessionId: string;
}

interface StatsHudProps {
  stats: PlaybackStats;
  onClose: () => void;
}

export function StatsHud({ stats, onClose }: StatsHudProps) {
  const dropRate =
    stats.totalFrames > 0
      ? ((stats.droppedFrames / stats.totalFrames) * 100).toFixed(2)
      : "0.00";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute top-16 left-6 z-50 bg-black/85 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 text-xs font-mono text-zinc-300 shadow-2xl max-w-sm pointer-events-auto select-none"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <div className="flex items-center gap-2 font-bold text-white">
          <Activity size={15} className="text-emerald-400 animate-pulse" />
          <span>Stats for Nerds (Stream QoE)</span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Close stats"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-1.5 leading-relaxed">
        <div className="flex justify-between">
          <span className="text-zinc-500">Video Engine:</span>
          <span className="font-semibold text-emerald-400 uppercase">
            {stats.playerEngine}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Resolution:</span>
          <span className="font-semibold text-white">{stats.resolution}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Viewport:</span>
          <span className="text-zinc-300">{stats.viewport}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Current Bitrate:</span>
          <span className="font-semibold text-amber-300">{stats.bitrateMbps} Mbps</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Buffer Health:</span>
          <span
            className={
              stats.bufferHealthSec > 15
                ? "text-emerald-400 font-semibold"
                : stats.bufferHealthSec > 5
                ? "text-yellow-400 font-semibold"
                : "text-red-400 font-semibold"
            }
          >
            {stats.bufferHealthSec.toFixed(1)} s
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Frame Drops:</span>
          <span className={stats.droppedFrames > 10 ? "text-amber-400" : "text-zinc-300"}>
            {stats.droppedFrames} / {stats.totalFrames} ({dropRate}%)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Codecs:</span>
          <span className="text-zinc-300">
            {stats.videoCodec} / {stats.audioCodec}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Audio Night Mode:</span>
          <span className={stats.audioNormalized ? "text-emerald-400" : "text-zinc-400"}>
            {stats.audioNormalized ? "Active (WebAudio Compressor)" : "Bypassed"}
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500 pt-1 border-t border-white/5">
          <span>Session:</span>
          <span className="truncate max-w-[170px]">{stats.sessionId}</span>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-zinc-400">
        <ShieldCheck size={12} className="text-blue-400" />
        <span>Hardware Deceleration Active • 1080p DRM Secured</span>
      </div>
    </motion.div>
  );
}
