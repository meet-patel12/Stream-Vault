"use client";

import { create } from "zustand";
import type { ContentItem, WatchProgress } from "@/types";

interface ContentState {
  featured: ContentItem[];
  myList: ContentItem[];
  watchHistory: WatchProgress[];
  currentContent: ContentItem | null;
  isPlayerOpen: boolean;
  playerVideoKey: string | null;
  playerVideoUrl: string | null;
  playerTitle: string | null;
  playerStartTime: number;

  setFeatured: (items: ContentItem[]) => void;
  setMyList: (items: ContentItem[]) => void;
  addToMyList: (item: ContentItem) => void;
  removeFromMyList: (contentId: number) => void;
  setWatchHistory: (history: WatchProgress[]) => void;
  updateWatchProgress: (progress: WatchProgress) => void;
  setCurrentContent: (content: ContentItem | null) => void;
  openPlayer: (videoKey: string, videoUrl: string, title: string, startTime?: number) => void;
  closePlayer: () => void;
  getProgress: (contentId: number) => WatchProgress | undefined;
}

export const useContentStore = create<ContentState>((set, get) => ({
  featured: [],
  myList: [],
  watchHistory: [],
  currentContent: null,
  isPlayerOpen: false,
  playerVideoKey: null,
  playerVideoUrl: null,
  playerTitle: null,
  playerStartTime: 0,

  setFeatured: (items) => set({ featured: items }),
  setMyList: (items) => set({ myList: items }),
  addToMyList: (item) =>
    set((state) => ({ myList: [...state.myList, item] })),
  removeFromMyList: (contentId) =>
    set((state) => ({
      myList: state.myList.filter((i) => i.id !== contentId),
    })),
  setWatchHistory: (history) => set({ watchHistory: history }),
  updateWatchProgress: (progress) =>
    set((state) => {
      const idx = state.watchHistory.findIndex(
        (h) => h.contentId === progress.contentId
      );
      if (idx >= 0) {
        const updated = [...state.watchHistory];
        updated[idx] = progress;
        return { watchHistory: updated };
      }
      return { watchHistory: [...state.watchHistory, progress] };
    }),
  setCurrentContent: (c) => set({ currentContent: c }),
  openPlayer: (videoKey, videoUrl, title, startTime = 0) =>
    set({
      isPlayerOpen: true,
      playerVideoKey: videoKey,
      playerVideoUrl: videoUrl,
      playerTitle: title,
      playerStartTime: startTime,
    }),
  closePlayer: () =>
    set({
      isPlayerOpen: false,
      playerVideoKey: null,
      playerVideoUrl: null,
      playerTitle: null,
      playerStartTime: 0,
    }),
  getProgress: (contentId) =>
    get().watchHistory.find((h) => h.contentId === contentId),
}));
