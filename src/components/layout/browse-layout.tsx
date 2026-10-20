"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "./navbar";
import { SearchPanel } from "@/components/search/search-panel";
import { PlayerModal } from "@/components/player/player-modal";
import { useAuthStore } from "@/store/auth-store";
import { useContentStore } from "@/store/content-store";

interface BrowseLayoutProps {
  children: ReactNode;
}

export function BrowseLayout({ children }: BrowseLayoutProps) {
  const router = useRouter();
  const { user, setUser, setProfiles, setActiveProfile, setHydrated, isHydrated } =
    useAuthStore();
  const { setMyList, setWatchHistory } = useContentStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize auth state from server
  useEffect(() => {
    setHydrated(true);
    const init = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/auth/login");
          return;
        }
        const data = await res.json();
        if (data.success) {
          setUser(data.data.user);
          setProfiles(data.data.profiles);

          // Set active profile if not already set
          const stored = useAuthStore.getState().activeProfile;
          if (!stored && data.data.profiles.length > 0) {
            setActiveProfile(data.data.profiles[0]);
          }

          // Load my list and watch history for active profile
          const activeProfile =
            stored ?? (data.data.profiles[0] || null);

          if (activeProfile) {
            const [listRes, historyRes] = await Promise.all([
              fetch(`/api/my-list?profileId=${activeProfile.id}`),
              fetch(`/api/watch/progress?profileId=${activeProfile.id}`),
            ]);

            if (listRes.ok) {
              const listData = await listRes.json();
              if (listData.success) setMyList(listData.data);
            }

            if (historyRes.ok) {
              const historyData = await historyRes.json();
              if (historyData.success) setWatchHistory(historyData.data);
            }
          }
        }
      } catch {
        router.push("/auth/login");
      } finally {
        setIsInitialized(true);
      }
    };
    init();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-2xl font-black text-red-600 tracking-tight">
            STREAM<span className="text-white">VAULT</span>
          </span>
          <div className="w-8 h-8 border-2 border-white/20 border-t-red-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar onSearchOpen={() => setIsSearchOpen(true)} />
      <SearchPanel isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <main>{children}</main>
      <PlayerModal />
    </div>
  );
}
