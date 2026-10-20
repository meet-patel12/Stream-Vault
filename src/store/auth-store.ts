"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, Profile } from "@/types";

interface AuthState {
  user: User | null;
  profiles: Profile[];
  activeProfile: Profile | null;
  isLoading: boolean;
  isHydrated: boolean;

  setUser: (user: User | null) => void;
  setProfiles: (profiles: Profile[]) => void;
  setActiveProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profiles: [],
      activeProfile: null,
      isLoading: false,
      isHydrated: false,

      setUser: (user) => set({ user }),
      setProfiles: (profiles) => set({ profiles }),
      setActiveProfile: (profile) => set({ activeProfile: profile }),
      setLoading: (loading) => set({ isLoading: loading }),
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
      logout: () =>
        set({ user: null, profiles: [], activeProfile: null }),
    }),
    {
      name: "streamvault-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeProfile: state.activeProfile,
      }),
    }
  )
);
