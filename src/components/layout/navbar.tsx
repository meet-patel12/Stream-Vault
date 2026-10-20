"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Film,
  Tv,
  Home,
  BookmarkCheck,
  Download,
  Sparkles,
  Clock,
  CreditCard,
  CheckCheck,
  Check,
  Palette,
  Volume2,
  VolumeX,
  Sun,
  Moon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useThemeStore, ThemeName } from "@/store/theme-store";
import { clsx } from "clsx";
import toast from "react-hot-toast";

interface NavbarProps {
  onSearchOpen?: () => void;
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

const THEME_OPTIONS: { id: ThemeName; name: string; color: string; desc: string }[] = [
  { id: "crimson", name: "Netflix Crimson", color: "#e50914", desc: "Signature cinematic dark" },
  { id: "cyberpunk", name: "Cyberpunk Neon", color: "#a855f7", desc: "Electric violet & cyan" },
  { id: "midnight", name: "Midnight AMOLED", color: "#38bdf8", desc: "Pure black & ice blue" },
  { id: "emerald", name: "Studio Ghibli", color: "#10b981", desc: "Forest emerald & amber" },
  { id: "light", name: "Daylight Mode", color: "#f8fafc", desc: "Luxury pearl & crisp slate" },
];

export function Navbar({ onSearchOpen }: NavbarProps) {
  const router = useRouter();
  const { user, activeProfile, profiles, setActiveProfile, logout } = useAuthStore();
  const { theme, setTheme, soundEnabled, toggleSound, tvMode, toggleTvMode, playMicroInteraction } = useThemeStore();

  const [scrolled, setScrolled] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(e.target as Node)) {
        setNotificationMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch notifications
  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications${activeProfile ? `?profileId=${activeProfile.id}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.data.notifications || []);
          setUnreadCount(data.data.unreadCount || 0);
        }
      }
    } catch {
      // Ignore
    }
  }, [activeProfile]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        playMicroInteraction("success");
        toast.success("All notifications marked as read");
      }
    } catch {
      toast.error("Failed to update notifications");
    }
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notification.id }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silently continue
      }
    }
    setNotificationMenuOpen(false);
    playMicroInteraction("click");
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      playMicroInteraction("click");
      await fetch("/api/auth/logout", { method: "POST" });
      logout();
      router.push("/auth/login");
    } catch {
      toast.error("Logout failed");
    }
  }, [logout, router, playMicroInteraction]);

  const navLinks = [
    { href: "/browse", icon: Home, label: "Home" },
    { href: "/browse/movies", icon: Film, label: "Movies" },
    { href: "/browse/series", icon: Tv, label: "TV Shows" },
    { href: "/browse/my-list", icon: BookmarkCheck, label: "My Library" },
    { href: "/browse/downloads", icon: Download, label: "Downloads" },
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_release":
        return <Film size={16} className="text-red-400" />;
      case "continue_watching":
        return <Clock size={16} className="text-blue-400" />;
      case "recommendation":
        return <Sparkles size={16} className="text-yellow-400" />;
      case "payment":
      case "subscription":
        return <CreditCard size={16} className="text-emerald-400" />;
      default:
        return <Bell size={16} className="text-zinc-400" />;
    }
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={clsx(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-black/90 dark:bg-black/90 light:bg-white/95 backdrop-blur-xl shadow-xl shadow-black/40 border-b border-white/5"
          : "bg-gradient-to-b from-black/80 via-black/40 to-transparent"
      )}
    >
      <div className="flex items-center justify-between px-4 sm:px-8 py-3.5">
        {/* Brand & Desktop Navigation */}
        <div className="flex items-center gap-8">
          <Link
            href="/browse"
            data-focusable="true"
            onClick={() => playMicroInteraction("click")}
            className="flex-shrink-0 flex items-center gap-2 group"
          >
            <span className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight transition-transform duration-300 group-hover:scale-102">
              STREAM<span className="text-white dark:text-white light:text-slate-900">VAULT</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                data-focusable="true"
                onClick={() => playMicroInteraction("navigate")}
                className="text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:text-white dark:hover:text-white light:hover:text-black text-sm font-semibold px-3 py-1.5 rounded-xl hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-slate-200/60 transition-all"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right Actions & Utilities */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Instant Search Button */}
          <button
            data-focusable="true"
            onClick={() => {
              playMicroInteraction("click");
              onSearchOpen?.();
            }}
            className="p-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:text-white rounded-full hover:bg-white/10 transition-all"
            aria-label="Search Catalog"
            title="Search (Hotkey: S or /)"
          >
            <Search size={19} />
          </button>

          {/* TV 10-Foot Mode Toggle */}
          <button
            data-focusable="true"
            onClick={() => toggleTvMode()}
            className={clsx(
              "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
              tvMode
                ? "bg-red-600/20 text-red-400 border-red-500/40 shadow-[0_0_12px_rgba(229,9,20,0.3)]"
                : "text-zinc-400 border-white/10 hover:text-white hover:bg-white/10"
            )}
            title="Toggle 10-Foot Spatial TV Mode (Press T)"
          >
            <Tv size={15} className={tvMode ? "animate-pulse" : ""} />
            <span className="hidden xl:inline">TV Mode</span>
            <span className="text-[10px] px-1 rounded bg-white/10 text-zinc-300 font-mono">T</span>
          </button>

          {/* Sound FX Toggle */}
          <button
            data-focusable="true"
            onClick={() => toggleSound()}
            className="p-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:text-white rounded-full hover:bg-white/10 transition-all"
            aria-label="Toggle Sound Effects"
            title={soundEnabled ? "Mute interface audio" : "Enable interface audio"}
          >
            {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} className="text-zinc-500" />}
          </button>

          {/* Dynamic Theme Picker */}
          <div className="relative" ref={themeMenuRef}>
            <button
              data-focusable="true"
              onClick={() => {
                playMicroInteraction("click");
                setThemeMenuOpen((v) => !v);
                setProfileMenuOpen(false);
                setNotificationMenuOpen(false);
              }}
              className="p-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:text-white rounded-full hover:bg-white/10 transition-all"
              aria-label="Dynamic Themes"
              title="Theme Palettes"
            >
              <Palette size={19} />
            </button>

            <AnimatePresence>
              {themeMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-64 bg-zinc-950/95 dark:bg-zinc-950/95 light:bg-white/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5 flex items-center justify-between">
                    <span>Visual Themes</span>
                    <Sparkles size={12} className="text-yellow-400" />
                  </p>
                  <div className="space-y-1">
                    {THEME_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        data-focusable="true"
                        onClick={() => {
                          setTheme(t.id);
                          setThemeMenuOpen(false);
                          toast.success(`Theme switched to ${t.name}`, { icon: "🎨" });
                        }}
                        className={clsx(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left",
                          theme === t.id
                            ? "bg-white/15 dark:bg-white/15 light:bg-slate-200 text-white dark:text-white light:text-black font-bold"
                            : "text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:bg-white/10"
                        )}
                      >
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0 shadow border border-white/20"
                          style={{ backgroundColor: t.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{t.name}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-400 light:text-slate-500 font-normal truncate">
                            {t.desc}
                          </p>
                        </div>
                        {theme === t.id && <Check size={14} className="text-red-500 ml-auto" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications Drawer */}
          <div className="relative" ref={notificationMenuRef}>
            <button
              data-focusable="true"
              onClick={() => {
                playMicroInteraction("click");
                setNotificationMenuOpen((v) => !v);
                setProfileMenuOpen(false);
                setThemeMenuOpen(false);
              }}
              className="relative p-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:text-white rounded-full hover:bg-white/10 transition-all"
              aria-label="Notifications"
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[17px] h-[17px] bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-[0_0_8px_#e50914] animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notificationMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-zinc-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/60">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-red-500" />
                      <span className="text-sm font-bold text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-red-600/30 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-semibold transition-colors"
                      >
                        <CheckCheck size={14} /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500 text-xs">
                        No notifications at this time.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={clsx(
                            "flex items-start gap-3 p-3.5 hover:bg-white/5 transition-all cursor-pointer text-left",
                            !n.isRead && "bg-red-950/15"
                          )}
                        >
                          <div className="p-2 rounded-xl bg-zinc-900 border border-white/10 flex-shrink-0 mt-0.5">
                            {getNotificationIcon(n.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className={clsx("text-xs truncate", !n.isRead ? "text-white font-bold" : "text-zinc-300 font-medium")}>
                                {n.title}
                              </p>
                              {!n.isRead && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                            </div>
                            <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                              {n.message}
                            </p>
                            <span className="text-[9px] text-zinc-500 mt-1 block">
                              {new Date(n.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              data-focusable="true"
              onClick={() => {
                playMicroInteraction("click");
                setProfileMenuOpen((v) => !v);
                setNotificationMenuOpen(false);
                setThemeMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl hover:bg-white/10 px-2 py-1.5 transition-all"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold shadow-md flex-shrink-0"
                style={{
                  backgroundColor: activeProfile?.avatarColor ?? "#E50914",
                }}
              >
                {activeProfile?.avatarEmoji ?? "🎬"}
              </div>
              <span className="hidden sm:block text-xs text-white font-semibold max-w-[80px] truncate">
                {activeProfile?.name ?? user?.email?.split("@")[0]}
              </span>
              <ChevronDown
                size={14}
                className={clsx(
                  "text-zinc-400 transition-transform duration-200",
                  profileMenuOpen && "rotate-180"
                )}
              />
            </button>

            <AnimatePresence>
              {profileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-zinc-950/95 dark:bg-zinc-950/95 light:bg-white/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-2"
                >
                  <div className="pb-2 border-b border-white/10">
                    <p className="text-[11px] text-zinc-500 px-2 pb-1 font-bold uppercase tracking-wider">
                      Profiles
                    </p>
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        data-focusable="true"
                        onClick={() => {
                          playMicroInteraction("click");
                          if (p.isLocked && activeProfile?.id !== p.id) {
                            router.push("/profiles");
                          } else {
                            setActiveProfile(p);
                          }
                          setProfileMenuOpen(false);
                        }}
                        className={clsx(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all",
                          activeProfile?.id === p.id
                            ? "bg-white/10 text-white font-bold"
                            : "text-zinc-300 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: p.avatarColor }}
                        >
                          {p.avatarEmoji}
                        </div>
                        <span className="truncate">{p.name}</span>
                        {p.isKids && (
                          <span className="text-[9px] bg-yellow-400 text-black font-extrabold px-1.5 py-0.2 rounded ml-auto">
                            KIDS
                          </span>
                        )}
                        {p.isLocked && !p.isKids && (
                          <span className="text-zinc-400 ml-auto text-xs">🔒</span>
                        )}
                        {activeProfile?.id === p.id && (
                          <span className="text-red-400 text-xs ml-1">✓</span>
                        )}
                      </button>
                    ))}
                    <Link
                      href="/profiles"
                      data-focusable="true"
                      onClick={() => {
                        playMicroInteraction("click");
                        setProfileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:bg-white/10 hover:text-white transition-all font-medium mt-1"
                    >
                      <User size={13} />
                      Manage Profiles
                    </Link>
                  </div>

                  {/* Account Settings */}
                  <div className="pt-2 space-y-0.5">
                    <Link
                      href="/account"
                      data-focusable="true"
                      onClick={() => {
                        playMicroInteraction("click");
                        setProfileMenuOpen(false);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all font-medium"
                    >
                      <Settings size={13} />
                      Account Settings
                    </Link>
                    {user?.role === "admin" && (
                      <Link
                        href="/admin"
                        data-focusable="true"
                        onClick={() => {
                          playMicroInteraction("click");
                          setProfileMenuOpen(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-yellow-400 hover:bg-white/10 transition-all font-bold"
                      >
                        <span>👑</span>
                        Admin Command Panel
                      </Link>
                    )}
                    <button
                      data-focusable="true"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-950/40 transition-all font-semibold"
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile Secondary Navigation Row */}
      <div className="lg:hidden flex items-center gap-1 px-4 pb-2.5 overflow-x-auto scrollbar-hide">
        {navLinks.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            data-focusable="true"
            onClick={() => playMicroInteraction("navigate")}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all whitespace-nowrap flex-shrink-0"
          >
            <Icon size={13} />
            {label}
          </Link>
        ))}
      </div>
    </motion.nav>
  );
}
