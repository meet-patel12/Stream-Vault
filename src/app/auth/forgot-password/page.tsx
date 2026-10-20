"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Email is required");
      return;
    }
    setError("");
    setIsLoading(true);

    // Simulate password reset (in production, send actual email)
    await new Promise((r) => setTimeout(r, 1500));
    setSent(true);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="fixed inset-0">
        <img
          src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&q=80"
          alt="Background"
          className="w-full h-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-black/80" />
      </div>

      <nav className="relative z-10 px-6 sm:px-12 py-6">
        <Link href="/">
          <span className="text-2xl font-black text-red-600 tracking-tight">
            STREAM<span className="text-white">VAULT</span>
          </span>
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 sm:p-10">
            {!sent ? (
              <>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back to login
                </Link>

                <h1 className="text-2xl font-black text-white mb-2">
                  Reset Password
                </h1>
                <p className="text-gray-400 text-sm mb-8">
                  Enter your email and we&apos;ll send you a reset link.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-lg text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="email"
                    label="Email Address"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={error && !email ? error : undefined}
                    leftIcon={<Mail size={16} />}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    className="w-full font-bold"
                  >
                    Send Reset Link
                  </Button>
                </form>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
                <p className="text-gray-400 text-sm mb-6">
                  We&apos;ve sent a password reset link to{" "}
                  <span className="text-white font-medium">{email}</span>
                </p>
                <Link href="/auth/login">
                  <Button variant="secondary" size="md" className="w-full">
                    Back to Login
                  </Button>
                </Link>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
