"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Check,
  Trash2,
  Lock,
  Unlock,
  Shield,
  Volume2,
  Subtitles,
  Globe,
  X,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types";
import toast from "react-hot-toast";
import { clsx } from "clsx";

const AVATAR_EMOJIS = [
  "🎬", "🦁", "🐺", "🦊", "🐧", "🎭", "🎪", "🎨", "🚀", "🌊", "🔥", "⚡", "🌙", "🌟", "🧸", "🍿",
];
const AVATAR_COLORS = [
  "#E50914", "#0080FF", "#FFD700", "#22c55e", "#a855f7", "#f97316", "#ec4899", "#06b6d4",
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "ko", label: "한국어 (Korean)" },
];

export default function ProfilesPage() {
  const router = useRouter();
  const { user, profiles, setProfiles, setActiveProfile } = useAuthStore();

  const [isManaging, setIsManaging] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎬");
  const [color, setColor] = useState("#E50914");
  const [isKids, setIsKids] = useState(false);
  const [pin, setPin] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [preferredAudio, setPreferredAudio] = useState("original");
  const [preferredSubtitle, setPreferredSubtitle] = useState("off");
  const [autoplayPreviews, setAutoplayPreviews] = useState(true);

  // PIN unlock prompt modal state
  const [pinPromptProfile, setPinPromptProfile] = useState<Profile | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
    }
  }, [user, router]);

  const handleSelectProfile = (profile: Profile) => {
    if (isManaging) {
      // Open edit modal for this profile
      setEditingProfile(profile);
      setName(profile.name);
      setEmoji(profile.avatarEmoji);
      setColor(profile.avatarColor);
      setIsKids(profile.isKids);
      setPin("");
      setPreferredLanguage(profile.preferredLanguage || "en");
      setPreferredAudio(profile.preferredAudio || "original");
      setPreferredSubtitle(profile.preferredSubtitle || "off");
      setAutoplayPreviews(profile.autoplayPreviews !== false);
      return;
    }

    if (profile.isLocked) {
      // Requires PIN
      setPinPromptProfile(profile);
      setEnteredPin("");
      return;
    }

    // Direct switch
    setActiveProfile(profile);
    router.push("/browse");
  };

  const handleVerifyPin = async () => {
    if (!pinPromptProfile || enteredPin.length !== 4) return;
    setIsVerifyingPin(true);
    try {
      const res = await fetch(`/api/profiles/${pinPromptProfile.id}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Welcome back, ${pinPromptProfile.name}!`);
        setActiveProfile(pinPromptProfile);
        setPinPromptProfile(null);
        router.push("/browse");
      } else {
        toast.error(data.error?.message || "Incorrect PIN");
        setEnteredPin("");
      }
    } catch {
      toast.error("Failed to verify PIN");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!name.trim()) {
      toast.error("Please enter a profile name");
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      toast.error("PIN must be 4 digits");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          avatarColor: color,
          avatarEmoji: emoji,
          isKids,
          pin: pin || undefined,
          preferredLanguage,
          preferredAudio,
          preferredSubtitle,
          autoplayPreviews,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfiles([...profiles, data.data]);
        setIsCreating(false);
        resetForm();
        toast.success("Profile created successfully!");
      } else {
        toast.error(data.error?.message ?? "Failed to create profile");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editingProfile) return;
    if (!name.trim()) {
      toast.error("Profile name is required");
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      toast.error("PIN must be 4 digits");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        avatarColor: color,
        avatarEmoji: emoji,
        isKids,
        preferredLanguage,
        preferredAudio,
        preferredSubtitle,
        autoplayPreviews,
      };
      if (pin !== "") {
        payload.pin = pin;
      }

      const res = await fetch(`/api/profiles/${editingProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfiles(
          profiles.map((p) => (p.id === editingProfile.id ? data.data : p))
        );
        setEditingProfile(null);
        resetForm();
        toast.success("Profile updated successfully!");
      } else {
        toast.error(data.error?.message ?? "Failed to update profile");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProfile = async (profileId: number) => {
    if (profiles.length <= 1) {
      toast.error("Cannot delete the last remaining profile");
      return;
    }
    setDeletingId(profileId);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, { method: "DELETE" });
      if (res.ok) {
        setProfiles(profiles.filter((p) => p.id !== profileId));
        toast.success("Profile deleted");
      } else {
        toast.error("Failed to delete profile");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setName("");
    setEmoji("🎬");
    setColor("#E50914");
    setIsKids(false);
    setPin("");
    setPreferredLanguage("en");
    setPreferredAudio("original");
    setPreferredSubtitle("off");
    setAutoplayPreviews(true);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 relative overflow-hidden select-none">
      {/* Dynamic Ambient Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-80" />

      <div className="relative z-10 w-full max-w-4xl py-12">
        {/* Header Logo */}
        <div className="text-center mb-10">
          <span className="text-3xl sm:text-4xl font-black text-red-600 tracking-tight">
            STREAM<span className="text-white">VAULT</span>
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-5">
            {isManaging ? "Manage Profiles" : "Who's watching?"}
          </h1>
          <p className="text-zinc-400 text-sm mt-2">
            {isManaging
              ? "Select a profile to customize settings, PIN, or preferences"
              : "Choose your personal space with individual lists and recommendations"}
          </p>
        </div>

        {/* Profile Avatars Grid */}
        <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-12">
          {profiles.map((profile, idx) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.06 }}
              className="flex flex-col items-center gap-3 group relative cursor-pointer"
              onClick={() => handleSelectProfile(profile)}
            >
              <div className="relative">
                <motion.div
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.96 }}
                  className={clsx(
                    "w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl shadow-2xl transition-all border-2",
                    isManaging
                      ? "border-red-500/80 brightness-75 group-hover:brightness-100"
                      : "border-transparent group-hover:border-white group-hover:shadow-[0_0_25px_rgba(255,255,255,0.3)]"
                  )}
                  style={{ backgroundColor: profile.avatarColor }}
                >
                  {profile.avatarEmoji}

                  {isManaging && (
                    <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                      <Edit2 size={24} className="text-white drop-shadow" />
                    </div>
                  )}
                </motion.div>

                {/* Delete button (in manage mode) */}
                {isManaging && profiles.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProfile(profile.id);
                    }}
                    disabled={deletingId === profile.id}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-all shadow-lg text-white"
                    title="Delete Profile"
                  >
                    {deletingId === profile.id ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}

                {/* Kids mode indicator badge */}
                {profile.isKids && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                    KIDS
                  </div>
                )}

                {/* Locked PIN Indicator Badge */}
                {profile.isLocked && !profile.isKids && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/20 text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 whitespace-nowrap">
                    <Lock size={10} className="text-yellow-400" /> PIN
                  </div>
                )}
              </div>

              <p className="text-zinc-300 group-hover:text-white text-sm sm:text-base font-bold transition-colors max-w-[110px] text-center truncate">
                {profile.name}
              </p>
            </motion.div>
          ))}

          {/* Add Profile Tile */}
          {profiles.length < 5 && !isCreating && !isManaging && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 group cursor-pointer"
              onClick={() => {
                resetForm();
                setIsCreating(true);
              }}
            >
              <motion.div
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.96 }}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-white flex items-center justify-center text-zinc-400 hover:text-white transition-all bg-zinc-900/40 hover:bg-zinc-800/60"
              >
                <Plus size={36} />
              </motion.div>
              <p className="text-zinc-400 group-hover:text-white text-sm font-bold">
                Add Profile
              </p>
            </motion.div>
          )}
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="glass"
            size="md"
            onClick={() => setIsManaging((prev) => !prev)}
            className="border-white/20 hover:border-white text-zinc-300 hover:text-white px-8 py-2.5 rounded-xl font-bold tracking-wider uppercase text-xs"
          >
            {isManaging ? "Done Managing" : "Manage Profiles"}
          </Button>
        </div>
      </div>

      {/* ─── 4-Digit PIN Unlock Prompt Modal ────────────────────────────── */}
      <AnimatePresence>
        {pinPromptProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-zinc-900 border border-white/10 p-6 rounded-2xl shadow-2xl text-center relative"
            >
              <button
                onClick={() => setPinPromptProfile(null)}
                className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-full bg-white/5"
              >
                <X size={18} />
              </button>

              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl shadow-lg"
                style={{ backgroundColor: pinPromptProfile.avatarColor }}
              >
                {pinPromptProfile.avatarEmoji}
              </div>

              <h2 className="text-xl font-black text-white">Profile Lock</h2>
              <p className="text-zinc-400 text-xs mt-1 mb-6">
                Enter your 4-digit PIN to access <strong>{pinPromptProfile.name}</strong>
              </p>

              {/* 4 PIN Dots */}
              <div className="flex justify-center gap-4 mb-6">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={clsx(
                      "w-4 h-4 rounded-full border-2 transition-all",
                      enteredPin.length > index
                        ? "bg-white border-white scale-110 shadow-[0_0_10px_#fff]"
                        : "border-zinc-600 bg-zinc-800"
                    )}
                  />
                ))}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => {
                      if (enteredPin.length < 4) {
                        const newPin = enteredPin + digit;
                        setEnteredPin(newPin);
                        if (newPin.length === 4) {
                          // Auto trigger
                          setTimeout(() => {
                            fetch(`/api/profiles/${pinPromptProfile.id}/verify-pin`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ pin: newPin }),
                            })
                              .then((r) => r.json())
                              .then((data) => {
                                if (data.success) {
                                  toast.success(`Welcome, ${pinPromptProfile.name}!`);
                                  setActiveProfile(pinPromptProfile);
                                  setPinPromptProfile(null);
                                  router.push("/browse");
                                } else {
                                  toast.error(data.error?.message || "Incorrect PIN");
                                  setEnteredPin("");
                                }
                              });
                          }, 150);
                        }
                      }
                    }}
                    className="w-16 h-12 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-white font-bold text-lg active:scale-95 transition-all"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  onClick={() => setEnteredPin("")}
                  className="w-16 h-12 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 text-xs font-bold active:scale-95 transition-all"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    if (enteredPin.length < 4) {
                      const newPin = enteredPin + "0";
                      setEnteredPin(newPin);
                    }
                  }}
                  className="w-16 h-12 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-white font-bold text-lg active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  onClick={() => setEnteredPin((prev) => prev.slice(0, -1))}
                  className="w-16 h-12 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 text-xs font-bold active:scale-95 transition-all"
                >
                  Delete
                </button>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleVerifyPin}
                isLoading={isVerifyingPin}
                disabled={enteredPin.length !== 4}
                className="w-full mt-2 font-bold"
              >
                Unlock Profile
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Profile Creation & Editing Modal ────────────────────────────── */}
      <AnimatePresence>
        {(isCreating || editingProfile) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-2xl shadow-2xl my-8 relative text-left"
            >
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingProfile(null);
                }}
                className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full bg-white/5"
              >
                <X size={18} />
              </button>

              <h2 className="text-2xl font-black text-white mb-1">
                {editingProfile ? "Edit Profile" : "Create New Profile"}
              </h2>
              <p className="text-zinc-400 text-xs mb-6">
                Customize identity, content restrictions, PIN lock, and playback preferences
              </p>

              {/* Avatar Preview & Selection */}
              <div className="flex items-center gap-5 mb-6 bg-zinc-900/60 p-4 rounded-xl border border-white/5">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shadow-lg flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {emoji}
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-500 rounded-lg px-3 py-2 text-white text-sm outline-none transition-all"
                  />
                </div>
              </div>

              {/* Emoji Picker */}
              <div className="mb-4">
                <label className="text-xs font-bold text-zinc-400 block mb-2">
                  Choose Avatar Emoji
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={clsx(
                        "w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all",
                        emoji === e
                          ? "bg-white/20 border-2 border-white scale-110"
                          : "bg-zinc-900 hover:bg-zinc-800"
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div className="mb-6">
                <label className="text-xs font-bold text-zinc-400 block mb-2">
                  Avatar Background Color
                </label>
                <div className="flex gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={clsx(
                        "w-8 h-8 rounded-full transition-all",
                        color === c ? "ring-2 ring-white scale-110" : "hover:opacity-80"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Kids Mode Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-900/70 border border-white/5 rounded-xl mb-4">
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    🧸 Kids Profile
                  </p>
                  <p className="text-xs text-zinc-400">
                    Only titles rated PG or lower will be visible
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isKids}
                  onChange={(e) => setIsKids(e.target.checked)}
                  className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                />
              </div>

              {/* PIN Protection Setting */}
              <div className="p-3.5 bg-zinc-900/70 border border-white/5 rounded-xl mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Lock size={15} className="text-yellow-400" />
                    4-Digit Profile PIN Lock
                  </p>
                  <span className="text-[11px] text-zinc-500">
                    {editingProfile?.isLocked ? "Currently Locked" : "Optional"}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-2">
                  Require a 4-digit PIN to access this profile
                </p>
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder={
                    editingProfile?.isLocked ? "Enter new PIN or leave blank to keep" : "e.g. 1234"
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-500 rounded-lg px-3 py-2 text-white text-sm outline-none tracking-widest"
                />
              </div>

              {/* Language Preferences */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1.5">
                    Audio Language
                  </label>
                  <select
                    value={preferredAudio}
                    onChange={(e) => setPreferredAudio(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-xs outline-none"
                  >
                    <option value="original">Original Audio</option>
                    <option value="en">English (Dub)</option>
                    <option value="hi">Hindi (Dub)</option>
                    <option value="es">Spanish (Dub)</option>
                    <option value="ja">Japanese (Dub)</option>
                    <option value="ko">Korean (Dub)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1.5">
                    Subtitle Language
                  </label>
                  <select
                    value={preferredSubtitle}
                    onChange={(e) => setPreferredSubtitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-xs outline-none"
                  >
                    <option value="off">Subtitles Off</option>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={editingProfile ? handleUpdateProfile : handleCreateProfile}
                  isLoading={isSubmitting}
                  className="flex-1 font-bold"
                >
                  {editingProfile ? "Save Changes" : "Create Profile"}
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingProfile(null);
                  }}
                  className="text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
