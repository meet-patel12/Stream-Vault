"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  Check,
  Sparkles,
  Volume2,
  Subtitles as SubtitlesIcon,
  Gauge,
  Sliders,
  Activity,
  Layers,
} from "lucide-react";
import { clsx } from "clsx";
import type { PlaybackSpeed } from "@/types";

export interface SubtitleStyles {
  fontSize: "sm" | "md" | "lg" | "xl";
  color: string;
  bgOpacity: number;
  outline: "none" | "shadow" | "raised" | "outline";
  delayMs: number;
}

export interface PlayerPreferences {
  autoplayNext: boolean;
  autoSkipIntro: boolean;
  highContrast: boolean;
  showStatsForNerds: boolean;
  nightModeAudio: boolean;
}

interface PlayerSettingsModalProps {
  onClose: () => void;
  // Quality
  availableQualities: string[];
  selectedQuality: string;
  onQualityChange: (q: string) => void;
  // Speed
  playbackSpeed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  // Audio
  audioTracks: { label: string; param: string }[];
  selectedAudio: string;
  onAudioChange: (track: { label: string; param: string }) => void;
  // Subtitles
  subtitleTracks: string[];
  selectedSubtitle: string;
  onSubtitleChange: (sub: string) => void;
  subtitleStyles: SubtitleStyles;
  onSubtitleStylesChange: (styles: SubtitleStyles) => void;
  // Preferences
  preferences: PlayerPreferences;
  onPreferencesChange: (prefs: PlayerPreferences) => void;
}

type Tab = "main" | "quality" | "speed" | "audio" | "subtitles" | "subtitle_styler" | "preferences";

const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlayerSettingsModal({
  onClose,
  availableQualities,
  selectedQuality,
  onQualityChange,
  playbackSpeed,
  onSpeedChange,
  audioTracks,
  selectedAudio,
  onAudioChange,
  subtitleTracks,
  selectedSubtitle,
  onSubtitleChange,
  subtitleStyles,
  onSubtitleStylesChange,
  preferences,
  onPreferencesChange,
}: PlayerSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("main");

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-4 bottom-24 w-72 sm:w-80 bg-zinc-950/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden z-50 text-white pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
        <div className="flex items-center gap-2">
          {activeTab !== "main" && (
            <button
              onClick={() => setActiveTab(activeTab === "subtitle_styler" ? "subtitles" : "main")}
              className="p-1 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span className="text-xs sm:text-sm font-bold capitalize">
            {activeTab === "main"
              ? "Player Settings"
              : activeTab === "subtitle_styler"
              ? "Subtitle Appearance"
              : activeTab}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10"
        >
          <X size={15} />
        </button>
      </div>

      {/* Main Tab */}
      {activeTab === "main" && (
        <div className="p-1 text-xs sm:text-sm divide-y divide-white/5">
          <button
            onClick={() => setActiveTab("quality")}
            className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-white/10 transition-colors rounded-xl text-left"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-red-400" />
              <span>Resolution Quality</span>
            </div>
            <span className="text-xs text-zinc-400">{selectedQuality} ›</span>
          </button>

          <button
            onClick={() => setActiveTab("speed")}
            className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-white/10 transition-colors rounded-xl text-left"
          >
            <div className="flex items-center gap-2.5">
              <Gauge size={16} className="text-amber-400" />
              <span>Playback Speed</span>
            </div>
            <span className="text-xs text-zinc-400">{playbackSpeed}x ›</span>
          </button>

          <button
            onClick={() => setActiveTab("audio")}
            className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-white/10 transition-colors rounded-xl text-left"
          >
            <div className="flex items-center gap-2.5">
              <Volume2 size={16} className="text-blue-400" />
              <span>Audio Language & Effects</span>
            </div>
            <span className="text-xs text-zinc-400 truncate max-w-[100px]">{selectedAudio} ›</span>
          </button>

          <button
            onClick={() => setActiveTab("subtitles")}
            className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-white/10 transition-colors rounded-xl text-left"
          >
            <div className="flex items-center gap-2.5">
              <SubtitlesIcon size={16} className="text-emerald-400" />
              <span>Subtitles & Styling</span>
            </div>
            <span className="text-xs text-zinc-400">{selectedSubtitle} ›</span>
          </button>

          <button
            onClick={() => setActiveTab("preferences")}
            className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-white/10 transition-colors rounded-xl text-left"
          >
            <div className="flex items-center gap-2.5">
              <Sliders size={16} className="text-purple-400" />
              <span>Playback Preferences</span>
            </div>
            <span className="text-xs text-zinc-400">Manage ›</span>
          </button>
        </div>
      )}

      {/* Quality Submenu */}
      {activeTab === "quality" && (
        <div className="p-1 max-h-64 overflow-y-auto">
          {availableQualities.map((q) => (
            <button
              key={q}
              onClick={() => {
                onQualityChange(q);
                setActiveTab("main");
              }}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm hover:bg-white/10 transition-colors text-left",
                selectedQuality === q ? "text-red-400 font-bold bg-white/5" : "text-zinc-300"
              )}
            >
              <span>{q}</span>
              {selectedQuality === q && <Check size={16} className="text-red-400" />}
            </button>
          ))}
        </div>
      )}

      {/* Speed Submenu */}
      {activeTab === "speed" && (
        <div className="p-1">
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => {
                onSpeedChange(s);
                setActiveTab("main");
              }}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm hover:bg-white/10 transition-colors text-left",
                playbackSpeed === s ? "text-red-400 font-bold bg-white/5" : "text-zinc-300"
              )}
            >
              <span>{s === 1 ? "1x (Normal)" : `${s}x`}</span>
              {playbackSpeed === s && <Check size={16} className="text-red-400" />}
            </button>
          ))}
        </div>
      )}

      {/* Audio Submenu */}
      {activeTab === "audio" && (
        <div className="p-2 space-y-3 max-h-72 overflow-y-auto">
          {/* Night Mode Audio Normalization Toggle */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-xs">Night Mode (Dialogue Boost)</span>
              <button
                onClick={() =>
                  onPreferencesChange({
                    ...preferences,
                    nightModeAudio: !preferences.nightModeAudio,
                  })
                }
                className={clsx(
                  "w-10 h-5 rounded-full transition-colors relative",
                  preferences.nightModeAudio ? "bg-red-600" : "bg-zinc-700"
                )}
              >
                <div
                  className={clsx(
                    "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform",
                    preferences.nightModeAudio ? "left-5" : "left-1"
                  )}
                />
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Dynamically compresses high-volume explosions while enhancing spoken dialogue.
            </p>
          </div>

          <p className="text-[11px] font-bold text-zinc-400 px-1">Available Audio Tracks</p>
          <div className="space-y-1">
            {audioTracks.map((track) => (
              <button
                key={track.label}
                onClick={() => {
                  onAudioChange(track);
                  setActiveTab("main");
                }}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-white/10 transition-colors text-left",
                  selectedAudio === track.label ? "text-red-400 font-bold bg-white/5" : "text-zinc-300"
                )}
              >
                <span>{track.label}</span>
                {selectedAudio === track.label && <Check size={16} className="text-red-400" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subtitles Submenu */}
      {activeTab === "subtitles" && (
        <div className="p-2 space-y-2 max-h-72 overflow-y-auto">
          <button
            onClick={() => setActiveTab("subtitle_styler")}
            className="w-full flex items-center justify-between p-2.5 bg-zinc-900/80 hover:bg-zinc-800 rounded-xl border border-white/10 text-xs font-bold text-amber-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers size={14} />
              <span>Customize Subtitle Style</span>
            </div>
            <span>›</span>
          </button>

          <p className="text-[11px] font-bold text-zinc-400 px-1 mt-2">Select Language</p>
          <div className="space-y-1">
            {subtitleTracks.map((sub) => (
              <button
                key={sub}
                onClick={() => {
                  onSubtitleChange(sub);
                  setActiveTab("main");
                }}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-white/10 transition-colors text-left",
                  selectedSubtitle === sub ? "text-red-400 font-bold bg-white/5" : "text-zinc-300"
                )}
              >
                <span>{sub}</span>
                {selectedSubtitle === sub && <Check size={16} className="text-red-400" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subtitle Appearance Styler */}
      {activeTab === "subtitle_styler" && (
        <div className="p-3 space-y-3 max-h-80 overflow-y-auto text-xs">
          {/* Live Subtitle Preview */}
          <div className="w-full h-16 bg-zinc-900/90 rounded-xl border border-white/10 flex items-center justify-center p-2">
            <span
              style={{
                fontSize:
                  subtitleStyles.fontSize === "sm"
                    ? "12px"
                    : subtitleStyles.fontSize === "lg"
                    ? "18px"
                    : subtitleStyles.fontSize === "xl"
                    ? "22px"
                    : "15px",
                color: subtitleStyles.color,
                backgroundColor: `rgba(0,0,0,${subtitleStyles.bgOpacity})`,
                textShadow:
                  subtitleStyles.outline === "shadow"
                    ? "2px 2px 3px black"
                    : subtitleStyles.outline === "outline"
                    ? "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
                    : "none",
              }}
              className="px-2 py-0.5 rounded font-semibold tracking-wide"
            >
              StreamVault Subtitle Preview
            </span>
          </div>

          {/* Font Size */}
          <div>
            <label className="text-[11px] text-zinc-400 font-bold block mb-1">Font Size</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["sm", "md", "lg", "xl"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => onSubtitleStylesChange({ ...subtitleStyles, fontSize: size })}
                  className={clsx(
                    "py-1.5 rounded-lg border text-center font-bold text-[11px] transition-colors",
                    subtitleStyles.fontSize === size
                      ? "bg-red-600 border-red-500 text-white"
                      : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                  )}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Font Color */}
          <div>
            <label className="text-[11px] text-zinc-400 font-bold block mb-1">Font Color</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { name: "White", hex: "#FFFFFF" },
                { name: "Yellow", hex: "#FFE600" },
                { name: "Cyan", hex: "#00E5FF" },
                { name: "Green", hex: "#00FF66" },
              ].map((c) => (
                <button
                  key={c.name}
                  onClick={() => onSubtitleStylesChange({ ...subtitleStyles, color: c.hex })}
                  className={clsx(
                    "py-1.5 rounded-lg border text-center text-[10px] font-bold flex items-center justify-center gap-1",
                    subtitleStyles.color === c.hex ? "border-white bg-white/20" : "border-white/10 bg-zinc-900"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Background Opacity */}
          <div>
            <label className="text-[11px] text-zinc-400 font-bold block mb-1">
              Background: {Math.round(subtitleStyles.bgOpacity * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.25}
              value={subtitleStyles.bgOpacity}
              onChange={(e) =>
                onSubtitleStylesChange({ ...subtitleStyles, bgOpacity: parseFloat(e.target.value) })
              }
              className="w-full accent-red-600"
            />
          </div>

          {/* Subtitle Delay Timing Offset */}
          <div>
            <label className="text-[11px] text-zinc-400 font-bold block mb-1">
              Sync Delay: {subtitleStyles.delayMs > 0 ? `+${subtitleStyles.delayMs}ms` : `${subtitleStyles.delayMs}ms`}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  onSubtitleStylesChange({
                    ...subtitleStyles,
                    delayMs: Math.max(-5000, subtitleStyles.delayMs - 500),
                  })
                }
                className="flex-1 py-1 bg-zinc-900 border border-white/10 rounded-lg text-zinc-300 hover:text-white"
              >
                -0.5s
              </button>
              <button
                onClick={() => onSubtitleStylesChange({ ...subtitleStyles, delayMs: 0 })}
                className="px-3 py-1 bg-zinc-800 border border-white/10 rounded-lg text-zinc-300 hover:text-white"
              >
                Reset
              </button>
              <button
                onClick={() =>
                  onSubtitleStylesChange({
                    ...subtitleStyles,
                    delayMs: Math.min(5000, subtitleStyles.delayMs + 500),
                  })
                }
                className="flex-1 py-1 bg-zinc-900 border border-white/10 rounded-lg text-zinc-300 hover:text-white"
              >
                +0.5s
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playback Preferences */}
      {activeTab === "preferences" && (
        <div className="p-3 space-y-3 text-xs">
          {/* Autoplay Next Episode */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Autoplay Next Episode</span>
              <span className="text-[10px] text-zinc-400">Play upcoming episode on credits</span>
            </div>
            <button
              onClick={() =>
                onPreferencesChange({ ...preferences, autoplayNext: !preferences.autoplayNext })
              }
              className={clsx(
                "w-10 h-5 rounded-full transition-colors relative",
                preferences.autoplayNext ? "bg-red-600" : "bg-zinc-700"
              )}
            >
              <div
                className={clsx(
                  "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform",
                  preferences.autoplayNext ? "left-5" : "left-1"
                )}
              />
            </button>
          </div>

          {/* Auto-Skip Intro */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Auto-Skip Intros</span>
              <span className="text-[10px] text-zinc-400">Automatically skip title sequence</span>
            </div>
            <button
              onClick={() =>
                onPreferencesChange({ ...preferences, autoSkipIntro: !preferences.autoSkipIntro })
              }
              className={clsx(
                "w-10 h-5 rounded-full transition-colors relative",
                preferences.autoSkipIntro ? "bg-red-600" : "bg-zinc-700"
              )}
            >
              <div
                className={clsx(
                  "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform",
                  preferences.autoSkipIntro ? "left-5" : "left-1"
                )}
              />
            </button>
          </div>

          {/* High Contrast UI */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">High Contrast Mode</span>
              <span className="text-[10px] text-zinc-400">Thick borders & maximum legibility</span>
            </div>
            <button
              onClick={() =>
                onPreferencesChange({ ...preferences, highContrast: !preferences.highContrast })
              }
              className={clsx(
                "w-10 h-5 rounded-full transition-colors relative",
                preferences.highContrast ? "bg-red-600" : "bg-zinc-700"
              )}
            >
              <div
                className={clsx(
                  "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform",
                  preferences.highContrast ? "left-5" : "left-1"
                )}
              />
            </button>
          </div>

          {/* Stats for Nerds HUD */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Stats for Nerds (QoE)</span>
              <span className="text-[10px] text-zinc-400">Real-time bitrates, drops & buffer</span>
            </div>
            <button
              onClick={() =>
                onPreferencesChange({
                  ...preferences,
                  showStatsForNerds: !preferences.showStatsForNerds,
                })
              }
              className={clsx(
                "w-10 h-5 rounded-full transition-colors relative",
                preferences.showStatsForNerds ? "bg-red-600" : "bg-zinc-700"
              )}
            >
              <div
                className={clsx(
                  "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform",
                  preferences.showStatsForNerds ? "left-5" : "left-1"
                )}
              />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
