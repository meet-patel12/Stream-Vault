"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setProfiles, setActiveProfile } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const validate = () => {
    const errs: typeof errors = {};
    if (!email) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Invalid email format";
    if (!password) errs.password = "Password is required";
    return errs;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const errs = validate();
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
      setErrors({});
      setIsLoading(true);

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrors({ general: data.error?.message ?? "Login failed" });
          toast.error(data.error?.message ?? "Login failed");
          return;
        }

        setUser(data.data.user);
        setProfiles(data.data.profiles);

        if (data.data.profiles.length > 0) {
          setActiveProfile(data.data.profiles[0]);
        }

        toast.success("Welcome back!");
        router.push("/browse");
      } catch {
        toast.error("Network error. Please try again.");
        setErrors({ general: "Network error. Please try again." });
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, setUser, setProfiles, setActiveProfile, router]
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Background */}
      <div className="fixed inset-0">
        <img
          src="https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1920&q=80"
          alt="Background"
          className="w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 px-6 sm:px-12 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
            STREAM<span className="text-white">VAULT</span>
          </span>
        </Link>
      </nav>

      {/* Form */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                <Play size={18} fill="white" className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Welcome back</h1>
                <p className="text-gray-400 text-sm">Sign in to your account</p>
              </div>
            </div>

            {/* Demo Credentials */}
            <div className="mb-6 p-3 bg-blue-900/20 border border-blue-500/30 rounded-xl">
              <p className="text-xs text-blue-300 font-semibold mb-1.5">🎬 Demo Credentials</p>
              <div className="space-y-1 text-xs text-blue-200">
                <button
                  type="button"
                  onClick={() => { setEmail("user@streamvault.io"); setPassword("User@123!"); }}
                  className="block w-full text-left hover:text-white transition-colors"
                >
                  👤 User: user@streamvault.io / User@123!
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail("admin@streamvault.io"); setPassword("Admin@123!"); }}
                  className="block w-full text-left hover:text-white transition-colors"
                >
                  👑 Admin: admin@streamvault.io / Admin@123!
                </button>
              </div>
            </div>

            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-lg text-red-300 text-sm flex items-center gap-2"
              >
                <span>⚠</span> {errors.general}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                label="Email Address"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                leftIcon={<Mail size={16} />}
                autoComplete="email"
              />

              <Input
                type={showPassword ? "text" : "password"}
                label="Password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                leftIcon={<Lock size={16} />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="focus:outline-none hover:text-white transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                autoComplete="current-password"
              />

              <div className="flex items-center justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full mt-2 text-base font-bold"
              >
                Sign In
              </Button>
            </form>

            <p className="mt-6 text-center text-gray-400 text-sm">
              New to StreamVault?{" "}
              <Link
                href="/auth/register"
                className="text-white font-semibold hover:text-red-400 transition-colors"
              >
                Create account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
