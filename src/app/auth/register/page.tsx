"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setProfiles, setActiveProfile } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getPasswordStrength(password);
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const strengthColors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

  const validate = () => {
    const errs: typeof errors = {};
    if (!name || name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (!email) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
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
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrors({ general: data.error?.message ?? "Registration failed" });
          toast.error(data.error?.message ?? "Registration failed");
          return;
        }

        setUser(data.data.user);
        setProfiles([data.data.profile]);
        setActiveProfile(data.data.profile);

        toast.success("Account created! Welcome to StreamVault 🎬");
        router.push("/browse");
      } catch {
        toast.error("Network error. Please try again.");
        setErrors({ general: "Network error. Please try again." });
      } finally {
        setIsLoading(false);
      }
    },
    [name, email, password, setUser, setProfiles, setActiveProfile, router]
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Background */}
      <div className="fixed inset-0">
        <img
          src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1920&q=80"
          alt="Background"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 px-6 sm:px-12 py-6">
        <Link href="/">
          <span className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
            STREAM<span className="text-white">VAULT</span>
          </span>
        </Link>
      </nav>

      {/* Form */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
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
                <h1 className="text-2xl font-black text-white">Create account</h1>
                <p className="text-gray-400 text-sm">Join millions of viewers</p>
              </div>
            </div>

            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-lg text-red-300 text-sm"
              >
                <span>⚠ </span>
                {errors.general}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                label="Display Name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                leftIcon={<User size={16} />}
                autoComplete="name"
              />

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

              <div>
                <Input
                  type={showPassword ? "text" : "password"}
                  label="Password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  leftIcon={<Lock size={16} />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="focus:outline-none hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  autoComplete="new-password"
                />
                {/* Password strength */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="flex-1 h-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor:
                              i <= strength ? strengthColors[strength] : "#374151",
                          }}
                        />
                      ))}
                    </div>
                    <p
                      className="text-xs font-medium"
                      style={{ color: strengthColors[strength] }}
                    >
                      {strengthLabels[strength]}
                    </p>
                  </div>
                )}
              </div>

              <Input
                type={showPassword ? "text" : "password"}
                label="Confirm Password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors.confirmPassword}
                leftIcon={<Lock size={16} />}
                autoComplete="new-password"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full mt-2 text-base font-bold"
              >
                Create Account
              </Button>
            </form>

            <p className="mt-4 text-center text-gray-500 text-xs">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </p>

            <p className="mt-4 text-center text-gray-400 text-sm">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-white font-semibold hover:text-red-400 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
