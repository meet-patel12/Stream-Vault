"use client";

import { create } from "zustand";

export type ThemeName = "crimson" | "cyberpunk" | "midnight" | "emerald" | "light";

interface ThemeState {
  theme: ThemeName;
  soundEnabled: boolean;
  tvMode: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleSound: () => void;
  toggleTvMode: () => void;
  playMicroInteraction: (type?: "click" | "switch" | "navigate" | "focus" | "success") => void;
}

// Synthesized Web Audio API sound generator (Zero external MP3 dependencies)
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playSynthesizedSound(type: "click" | "switch" | "navigate" | "focus" | "success" = "click") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === "switch") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === "navigate" || type === "focus") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.05);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch {
    // Fail silently without breaking UI
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "crimson",
  soundEnabled: true,
  tvMode: false,

  setTheme: (theme: ThemeName) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sv_theme", theme);
      const root = document.documentElement;
      root.setAttribute("data-theme", theme);
      if (theme === "light") {
        root.classList.remove("dark");
        root.classList.add("light");
      } else {
        root.classList.remove("light");
        root.classList.add("dark");
      }
    }
    if (get().soundEnabled) {
      playSynthesizedSound("switch");
    }
    set({ theme });
  },

  toggleSound: () => {
    const next = !get().soundEnabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("sv_sound", String(next));
    }
    if (next) playSynthesizedSound("switch");
    set({ soundEnabled: next });
  },

  toggleTvMode: () => {
    const next = !get().tvMode;
    if (typeof window !== "undefined") {
      localStorage.setItem("sv_tv_mode", String(next));
      if (next) {
        document.documentElement.classList.add("tv-mode");
      } else {
        document.documentElement.classList.remove("tv-mode");
      }
    }
    if (get().soundEnabled) playSynthesizedSound("switch");
    set({ tvMode: next });
  },

  playMicroInteraction: (type = "click") => {
    if (get().soundEnabled) {
      playSynthesizedSound(type);
    }
  },
}));

// Hydration helper to restore saved theme on first client mount
export function initializeTheme() {
  if (typeof window === "undefined") return;
  const savedTheme = (localStorage.getItem("sv_theme") as ThemeName) || "crimson";
  const savedSound = localStorage.getItem("sv_sound") !== "false";
  const savedTv = localStorage.getItem("sv_tv_mode") === "true";

  const root = document.documentElement;
  root.setAttribute("data-theme", savedTheme);
  if (savedTheme === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
  }

  if (savedTv) {
    root.classList.add("tv-mode");
  }

  useThemeStore.setState({
    theme: savedTheme,
    soundEnabled: savedSound,
    tvMode: savedTv,
  });
}
