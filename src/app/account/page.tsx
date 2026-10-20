"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Shield,
  CreditCard,
  LogOut,
  Star,
  Lock,
  Check,
  AlertCircle,
  FileText,
  PauseCircle,
  PlayCircle,
  XCircle,
  RefreshCw,
  Tag,
  Sparkles,
  Download,
  DollarSign,
  ChevronRight,
  Zap,
  Smartphone,
  Laptop,
  KeyRound,
  History,
  QrCode,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { BrowseLayout } from "@/components/layout/browse-layout";
import toast from "react-hot-toast";
import {
  PLAN_CONFIGS,
  SubscriptionPlanTier,
  BillingCycle,
  SupportedCurrency,
  PaymentGatewayType,
  BILLING_CYCLE_MULTIPLIERS,
  CURRENCY_SYMBOLS,
} from "@/lib/payment-gateways/types";
import { clsx } from "clsx";

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profiles, activeProfile, logout } = useAuthStore();

  const [subData, setSubData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingSub, setLoadingSub] = useState(true);

  // Upgrade/Downgrade Plan Modal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanTier>("premium");
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>("USD");
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayType>("stripe");
  const [couponCode, setCouponCode] = useState("");
  const [validatedCoupon, setValidatedCoupon] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Security, Devices & 2FA State
  const [devices, setDevices] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [show2faModal, setShow2faModal] = useState(false);
  const [twoFaSetupData, setTwoFaSetupData] = useState<{ secret: string; otpauthUrl: string; backupCodes: string[] } | null>(null);
  const [twoFaCodeInput, setTwoFaCodeInput] = useState("");
  const [isVerifying2fa, setIsVerifying2fa] = useState(false);

  // Pause / Cancel Confirmation states
  const [actionLoading, setActionLoading] = useState(false);

  const loadSubscriptionData = useCallback(async () => {
    try {
      const res = await fetch("/api/subscriptions/current");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSubData(data.data.subscription);
          setInvoices(data.data.invoices || []);
        }
      }
    } catch (err) {
      console.error("Failed to load subscription data", err);
    } finally {
      setLoadingSub(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptionData();

    // Load Security & Devices Data
    const loadSecurity = async () => {
      try {
        const [devRes, histRes] = await Promise.all([
          fetch("/api/auth/devices"),
          fetch("/api/auth/login-history"),
        ]);
        if (devRes.ok) {
          const dData = await devRes.json();
          if (dData.success) setDevices(dData.data.devices || []);
        }
        if (histRes.ok) {
          const hData = await histRes.json();
          if (hData.success) setLoginHistory(hData.data.history || []);
        }
      } catch {
        // Silently continue
      }
    };
    loadSecurity();

    // Check for query params indicating session completion
    if (searchParams.get("session_status") === "success") {
      toast.success("Payment completed! Your subscription is active.");
      loadSubscriptionData();
    }
  }, [loadSubscriptionData, searchParams]);

  const handleStart2fa = async () => {
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTwoFaSetupData(data.data);
        setShow2faModal(true);
      } else {
        toast.error("Failed to initiate 2FA setup");
      }
    } catch {
      toast.error("Error starting 2FA setup");
    }
  };

  const handleVerify2fa = async () => {
    if (!twoFaCodeInput || twoFaCodeInput.trim().length !== 6) {
      toast.error("Enter a valid 6-digit code");
      return;
    }
    setIsVerifying2fa(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFaCodeInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTwoFaEnabled(true);
        setShow2faModal(false);
        setTwoFaSetupData(null);
        setTwoFaCodeInput("");
        toast.success("Two-Factor Authentication is now enabled!", { icon: "🛡️" });
      } else {
        toast.error(data.error?.message || "Invalid code. Try again.");
      }
    } catch {
      toast.error("Verification failed");
    } finally {
      setIsVerifying2fa(false);
    }
  };

  const handleDisable2fa = async () => {
    if (!confirm("Are you sure you want to disable Two-Factor Authentication?")) return;
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setTwoFaEnabled(false);
        toast.success("Two-Factor Authentication disabled");
      }
    } catch {
      toast.error("Failed to disable 2FA");
    }
  };

  const handleRevokeDevice = async (id: number) => {
    try {
      const res = await fetch(`/api/auth/devices?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Device revoked");
        setDevices((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      toast.error("Failed to revoke device");
    }
  };

  const handleRevokeAllOthers = async () => {
    if (!confirm("Sign out of all other devices? This will invalidate all other active sessions.")) return;
    try {
      const res = await fetch("/api/auth/devices?revokeAllOthers=true", { method: "DELETE" });
      if (res.ok) {
        toast.success("Signed out of all other devices successfully.");
        setDevices((prev) => prev.filter((d) => d.isCurrent));
      }
    } catch {
      toast.error("Failed to revoke sessions");
    }
  };

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setValidatedCoupon(data.data);
        toast.success(`Coupon "${data.data.code}" applied! (${data.data.discountPercent}% OFF)`);
      } else {
        setValidatedCoupon(null);
        toast.error(data.error?.message || "Invalid coupon");
      }
    } catch {
      toast.error("Coupon validation failed");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleInitiateCheckout = async () => {
    setIsProcessingCheckout(true);
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          billingCycle: selectedCycle,
          currency: selectedCurrency,
          gateway: selectedGateway,
          couponCode: validatedCoupon ? validatedCoupon.code : couponCode || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.data.redirectUrl) {
          toast.success("Redirecting to secure gateway...");
          window.location.href = data.data.redirectUrl;
        } else {
          toast.success("Subscription updated!");
          setIsPlanModalOpen(false);
          loadSubscriptionData();
        }
      } else {
        toast.error(data.error?.message || "Checkout failed");
      }
    } catch {
      toast.error("Checkout failed due to network error");
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const handlePauseSubscription = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/subscriptions/pause", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.data.message);
        loadSubscriptionData();
      } else {
        toast.error(data.error?.message || "Pause failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/subscriptions/resume", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.data.message);
        loadSubscriptionData();
      } else {
        toast.error(data.error?.message || "Resume failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You will still retain access until the end of your billing cycle.")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.data.message);
        loadSubscriptionData();
      } else {
        toast.error(data.error?.message || "Cancellation failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      logout();
      router.push("/auth/login");
      toast.success("Signed out successfully");
    } catch {
      toast.error("Logout failed");
    }
  };

  const currentPlanTier = (subData?.plan as SubscriptionPlanTier) || "basic";
  const currentPlanObj = PLAN_CONFIGS[currentPlanTier] || PLAN_CONFIGS.basic;
  const isPaused = subData?.status === "paused";
  const isCanceled = subData?.status === "canceled";

  // Calculate pricing preview for selected plan in modal
  const selectedPlanPrice = PLAN_CONFIGS[selectedPlan].prices[selectedCurrency] || PLAN_CONFIGS[selectedPlan].prices.USD;
  const cycleDiscount = BILLING_CYCLE_MULTIPLIERS[selectedCycle].discountPercent;
  const cycleMonths = BILLING_CYCLE_MULTIPLIERS[selectedCycle].months;
  const rawTotal = selectedPlanPrice * cycleMonths;
  const discountTotal = (rawTotal * cycleDiscount) / 100;
  const couponDiscount = validatedCoupon?.discountPercent
    ? ((rawTotal - discountTotal) * validatedCoupon.discountPercent) / 100
    : 0;
  const netAmount = Math.max(rawTotal - discountTotal - couponDiscount, 0);
  const gstAmount = (netAmount * 18) / 100;
  const grandTotal = netAmount + gstAmount;

  return (
    <BrowseLayout>
      <div className="min-h-screen bg-black pt-20 sm:pt-28 pb-20 px-4 sm:px-12 select-none">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* User Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-xl border border-white/20"
                style={{ backgroundColor: activeProfile?.avatarColor ?? "#E50914" }}
              >
                {activeProfile?.avatarEmoji ?? "🎬"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white">Account & Membership</h1>
                  <span className="text-xs bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold">
                    PRO
                  </span>
                </div>
                <p className="text-zinc-400 text-sm">{user?.email}</p>
              </div>
            </div>

            <Button
              variant="glass"
              size="sm"
              onClick={handleLogout}
              leftIcon={<LogOut size={15} />}
              className="text-red-400 hover:text-red-300 border-red-900/30 hover:border-red-600/40"
            >
              Sign Out
            </Button>
          </div>

          <div className="space-y-6">
            {/* Membership & Current Plan Banner */}
            <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-xs font-black tracking-widest uppercase text-red-500 flex items-center gap-1">
                      <Sparkles size={14} /> CURRENT MEMBERSHIP
                    </span>
                    {isPaused && (
                      <span className="text-[10px] bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 px-2 py-0.5 rounded-full font-bold">
                        PAUSED
                      </span>
                    )}
                    {isCanceled && (
                      <span className="text-[10px] bg-red-600/20 text-red-400 border border-red-600/30 px-2 py-0.5 rounded-full font-bold">
                        CANCELED
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl font-black text-white capitalize">{currentPlanObj.name}</h2>
                  <p className="text-zinc-400 text-sm mt-1">{currentPlanObj.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setIsPlanModalOpen(true)}
                    className="font-bold shadow-lg shadow-red-900/30 px-6"
                  >
                    Change Plan
                  </Button>
                </div>
              </div>

              {/* Plan Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-black/40 rounded-xl border border-white/5 mb-6">
                <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase">Video Quality</p>
                  <p className="text-white text-sm font-black mt-0.5 uppercase">{currentPlanObj.maxQuality}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase">Simultaneous Screens</p>
                  <p className="text-white text-sm font-black mt-0.5">{currentPlanObj.maxScreens} Screens</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase">Spatial Audio</p>
                  <p className="text-white text-sm font-black mt-0.5">{currentPlanObj.hasSpatialAudio ? "Dolby Atmos" : "Stereo 5.1"}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase">Renewal Date</p>
                  <p className="text-white text-sm font-black mt-0.5">
                    {subData?.currentPeriodEnd
                      ? new Date(subData.currentPeriodEnd).toLocaleDateString()
                      : "Monthly Auto"}
                  </p>
                </div>
              </div>

              {/* Pause, Resume, Cancel Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10 flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  {isPaused ? (
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={handleResumeSubscription}
                      isLoading={actionLoading}
                      leftIcon={<PlayCircle size={15} className="text-emerald-400" />}
                    >
                      Resume Subscription
                    </Button>
                  ) : (
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={handlePauseSubscription}
                      isLoading={actionLoading}
                      leftIcon={<PauseCircle size={15} className="text-yellow-400" />}
                    >
                      Pause Subscription
                    </Button>
                  )}

                  {!isCanceled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelSubscription}
                      isLoading={actionLoading}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      Cancel Membership
                    </Button>
                  )}
                </div>

                <div className="text-xs text-zinc-500 flex items-center gap-1">
                  <Shield size={13} className="text-emerald-400" />
                  PCI-DSS Certified 256-bit Encryption
                </div>
              </div>
            </div>

            {/* Profile Management Section */}
            <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <User size={18} className="text-blue-400" />
                  Profiles & Parental Controls ({profiles.length}/5)
                </h3>
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => router.push("/profiles")}
                >
                  Manage Profiles
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3.5 p-3 rounded-xl bg-black/40 border border-white/5"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.avatarEmoji}
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">{p.name}</p>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        {p.isKids ? (
                          <span className="text-yellow-400 font-semibold">Kids Profile</span>
                        ) : (
                          <span>All Maturity</span>
                        )}
                        {p.isLocked && <span className="text-zinc-500">🔒 PIN Protected</span>}
                      </div>
                    </div>
                    {activeProfile?.id === p.id && (
                      <span className="ml-auto text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                        Active
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Billing History & GST Invoices */}
            <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <FileText size={18} className="text-purple-400" />
                  Billing History & GST Invoices
                </h3>
                <span className="text-xs text-zinc-400">
                  {invoices.length} Paid Invoices
                </span>
              </div>

              {invoices.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">
                  No previous invoices found. Your future receipts will be archived here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-400">
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5">Invoice #</th>
                        <th className="py-2.5">Gateway</th>
                        <th className="py-2.5">Base + 18% GST</th>
                        <th className="py-2.5">Total Paid</th>
                        <th className="py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="text-zinc-300">
                          <td className="py-3">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 font-mono font-bold text-white">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3 uppercase text-zinc-400 font-bold">
                            {inv.paymentGateway}
                          </td>
                          <td className="py-3">
                            {CURRENCY_SYMBOLS[inv.currency as SupportedCurrency] || "$"}
                            {(inv.amount - inv.gstAmount).toFixed(2)} + GST {CURRENCY_SYMBOLS[inv.currency as SupportedCurrency] || "$"}{inv.gstAmount.toFixed(2)}
                          </td>
                          <td className="py-3 font-bold text-emerald-400">
                            {CURRENCY_SYMBOLS[inv.currency as SupportedCurrency] || "$"}
                            {inv.amount.toFixed(2)}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => {
                                window.print();
                              }}
                              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 ml-auto font-bold"
                            >
                              <Download size={12} /> GST PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ─── Security, Devices & 2FA Section ─── */}
            <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Shield size={18} className="text-emerald-400" />
                  Account Security & Connected Devices
                </h3>
                {twoFaEnabled ? (
                  <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                    <Check size={12} /> 2FA Active
                  </span>
                ) : (
                  <span className="text-xs bg-yellow-950 text-yellow-400 border border-yellow-800/40 px-2.5 py-1 rounded-full font-bold">
                    2FA Recommended
                  </span>
                )}
              </div>

              {/* 2FA Card */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <KeyRound size={16} className="text-emerald-400" /> Two-Factor Authentication (TOTP)
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-lg">
                    Add an extra layer of defense using Google Authenticator, Authy, or 1Password. Required for high-security device logins.
                  </p>
                </div>
                <div>
                  {twoFaEnabled ? (
                    <Button variant="ghost" size="sm" onClick={handleDisable2fa} className="text-red-400 hover:text-red-300">
                      Disable 2FA
                    </Button>
                  ) : (
                    <Button variant="glass" size="sm" onClick={handleStart2fa} className="font-bold border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/40">
                      Enable 2FA
                    </Button>
                  )}
                </div>
              </div>

              {/* Connected Devices */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Laptop size={15} className="text-blue-400" /> Active Devices ({devices.length})
                  </h4>
                  {devices.length > 1 && (
                    <button
                      onClick={handleRevokeAllOthers}
                      className="text-xs text-red-400 hover:text-red-300 font-bold underline"
                    >
                      Sign Out All Other Devices
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {devices.map((dev) => (
                    <div
                      key={dev.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300">
                          {dev.deviceType === "mobile" ? <Smartphone size={16} /> : <Laptop size={16} />}
                        </div>
                        <div>
                          <p className="text-white font-bold flex items-center gap-2">
                            {dev.deviceName}
                            {dev.isCurrent && (
                              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-black">
                                THIS DEVICE
                              </span>
                            )}
                          </p>
                          <p className="text-zinc-500 text-[11px] mt-0.5">
                            IP: {dev.ipAddress || "127.0.0.1"} • Last Active: {new Date(dev.lastActiveAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {!dev.isCurrent && (
                        <button
                          onClick={() => handleRevokeDevice(dev.id)}
                          className="text-xs text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Login Audit Trail */}
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                  <History size={15} className="text-purple-400" /> Recent Security & Login Events
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-400">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-500 uppercase tracking-wider text-[10px]">
                        <th className="pb-2">Time</th>
                        <th className="pb-2">IP Address</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {loginHistory.slice(0, 5).map((h) => (
                        <tr key={h.id}>
                          <td className="py-2.5 text-zinc-300 font-medium">
                            {new Date(h.attemptedAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 font-mono text-zinc-400">{h.ipAddress || "127.0.0.1"}</td>
                          <td className="py-2.5">
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                              AUTHORIZED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── Plan Switcher & Multi-Gateway Checkout Modal ──────────────── */}
      <AnimatePresence>
        {isPlanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-2xl shadow-2xl my-6 relative text-left"
            >
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full bg-white/5"
              >
                ✕
              </button>

              <h2 className="text-2xl font-black text-white mb-1">Select Your Streaming Plan</h2>
              <p className="text-zinc-400 text-xs mb-6">
                Upgrade, downgrade, or switch billing cycles anytime. Cancel with 1-click.
              </p>

              {/* Currency & Billing Cycle Switchers */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-zinc-900/60 rounded-xl border border-white/5 mb-6">
                {/* Billing Cycle Pill */}
                <div className="flex items-center gap-1 bg-black p-1 rounded-xl border border-white/10 w-full sm:w-auto">
                  {(["monthly", "quarterly", "annual"] as BillingCycle[]).map((cycle) => (
                    <button
                      key={cycle}
                      onClick={() => setSelectedCycle(cycle)}
                      className={clsx(
                        "flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                        selectedCycle === cycle
                          ? "bg-red-600 text-white shadow-md"
                          : "text-zinc-400 hover:text-white"
                      )}
                    >
                      {cycle.toUpperCase()}
                      {cycle === "quarterly" && " (10% OFF)"}
                      {cycle === "annual" && " (20% OFF)"}
                    </button>
                  ))}
                </div>

                {/* Currency Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-bold">Currency:</span>
                  <div className="flex gap-1 bg-black p-1 rounded-xl border border-white/10">
                    {(["USD", "INR", "EUR", "GBP"] as SupportedCurrency[]).map((cur) => (
                      <button
                        key={cur}
                        onClick={() => setSelectedCurrency(cur)}
                        className={clsx(
                          "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                          selectedCurrency === cur ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"
                        )}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Plan Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {(["basic", "standard", "premium"] as SubscriptionPlanTier[]).map((tier) => {
                  const p = PLAN_CONFIGS[tier];
                  const price = p.prices[selectedCurrency];
                  const isSelected = selectedPlan === tier;
                  return (
                    <div
                      key={tier}
                      onClick={() => setSelectedPlan(tier)}
                      className={clsx(
                        "p-4 rounded-xl border cursor-pointer transition-all relative flex flex-col justify-between",
                        isSelected
                          ? "bg-red-950/20 border-red-500 shadow-[0_0_20px_rgba(229,9,20,0.2)]"
                          : "bg-zinc-900/40 border-white/5 hover:border-white/20"
                      )}
                    >
                      {tier === "premium" && (
                        <span className="absolute -top-2.5 right-3 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                          MOST POPULAR
                        </span>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-white font-bold text-base capitalize">{p.name}</h4>
                          {isSelected && <Check size={16} className="text-red-500" />}
                        </div>
                        <p className="text-2xl font-black text-white">
                          {CURRENCY_SYMBOLS[selectedCurrency]}
                          {price.toFixed(2)}
                          <span className="text-xs text-zinc-400 font-normal">/mo</span>
                        </p>
                        <p className="text-[11px] text-zinc-400 uppercase font-bold mt-1">
                          {p.maxQuality} · {p.maxScreens} Screen{p.maxScreens > 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5 text-xs text-zinc-400">
                        {p.features.map((feat, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Check size={11} className="text-red-500 flex-shrink-0" />
                            <span className="truncate">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupon Code Section */}
              <div className="flex items-center gap-2 mb-6 bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                <Tag size={16} className="text-zinc-400 ml-1" />
                <input
                  type="text"
                  placeholder="Enter Promo or Coupon Code (e.g. STREAM50, NETFLIX20)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="bg-transparent text-white text-xs flex-1 outline-none font-mono"
                />
                <Button
                  variant="glass"
                  size="sm"
                  onClick={handleValidateCoupon}
                  isLoading={isValidatingCoupon}
                  className="text-xs py-1"
                >
                  Apply Code
                </Button>
              </div>

              {/* Payment Gateway Selector */}
              <div className="mb-6">
                <label className="text-xs font-bold text-zinc-400 block mb-2">
                  Select Real Payment Gateway (Test & Live Certified)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "stripe", label: "Credit Card (Stripe)", logo: "💳" },
                    { id: "razorpay", label: "Razorpay (UPI / NetBanking)", logo: "⚡" },
                    { id: "paypal", label: "PayPal Express", logo: "🅿️" },
                    { id: "apple_pay", label: "Apple / Google Pay", logo: "📱" },
                  ].map((gw) => (
                    <button
                      key={gw.id}
                      type="button"
                      onClick={() => setSelectedGateway(gw.id as PaymentGatewayType)}
                      className={clsx(
                        "p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-2",
                        selectedGateway === gw.id
                          ? "bg-white/10 border-white text-white"
                          : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-white"
                      )}
                    >
                      <span className="text-base">{gw.logo}</span>
                      <span className="truncate">{gw.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Breakdown Footer */}
              <div className="bg-black/60 p-4 rounded-xl border border-white/10 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-zinc-400">Total Billed Today (Includes 18% GST):</p>
                  <p className="text-3xl font-black text-white">
                    {CURRENCY_SYMBOLS[selectedCurrency]}
                    {grandTotal.toFixed(2)}
                  </p>
                  {couponDiscount > 0 && (
                    <p className="text-xs text-emerald-400 font-bold">
                      Saved {CURRENCY_SYMBOLS[selectedCurrency]}{couponDiscount.toFixed(2)} with coupon!
                    </p>
                  )}
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleInitiateCheckout}
                  isLoading={isProcessingCheckout}
                  className="font-black px-8 shadow-xl shadow-red-900/40"
                >
                  Pay & Activate Plan
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ─── Two-Factor Authentication Setup Modal ─────────────────── */}
        {show2faModal && twoFaSetupData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-2xl shadow-2xl my-6 relative text-left"
            >
              <button
                onClick={() => setShow2faModal(false)}
                className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full bg-white/5"
              >
                ✕
              </button>

              <div className="flex items-center gap-2 mb-2">
                <Shield size={24} className="text-emerald-400" />
                <h2 className="text-2xl font-black text-white">Enable Two-Factor (2FA)</h2>
              </div>
              <p className="text-zinc-400 text-xs mb-5">
                Protect your StreamVault account from unauthorized access.
              </p>

              {/* Step 1: Secret Key */}
              <div className="mb-5 p-3.5 bg-zinc-900/80 rounded-xl border border-white/5">
                <p className="text-xs font-bold text-zinc-300 mb-1">1. Add Secret Key to Authenticator</p>
                <p className="text-[11px] text-zinc-500 mb-2">
                  Open Google Authenticator, Authy, or 1Password and add this key manually:
                </p>
                <div className="flex items-center justify-between p-2.5 bg-black rounded-lg border border-white/10 font-mono text-xs text-emerald-400 select-all">
                  <span className="tracking-widest">{twoFaSetupData.secret}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(twoFaSetupData.secret);
                      toast.success("Secret key copied!");
                    }}
                    className="p-1 hover:text-white text-zinc-400"
                    title="Copy Secret"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Step 2: Backup Codes */}
              <div className="mb-5 p-3.5 bg-zinc-900/80 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-zinc-300">2. Save Backup Recovery Codes</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(twoFaSetupData.backupCodes.join("\n"));
                      toast.success("Backup codes copied!");
                    }}
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Copy size={11} /> Copy All
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mb-2">
                  Store these in a safe place. You can use them if you ever lose your phone.
                </p>
                <div className="grid grid-cols-2 gap-1.5 p-2 bg-black rounded-lg border border-white/10 font-mono text-[10px] text-zinc-300">
                  {twoFaSetupData.backupCodes.map((code, idx) => (
                    <span key={idx} className="truncate">{code}</span>
                  ))}
                </div>
              </div>

              {/* Step 3: Enter 6-digit Code */}
              <div className="mb-6">
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  3. Enter 6-Digit Authenticator Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={twoFaCodeInput}
                  onChange={(e) => setTwoFaCodeInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handleVerify2fa}
                isLoading={isVerifying2fa}
                disabled={twoFaCodeInput.length !== 6}
                className="w-full font-bold bg-emerald-600 hover:bg-emerald-500 border-none shadow-xl shadow-emerald-900/30"
              >
                Verify & Activate 2FA
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </BrowseLayout>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <BrowseLayout>
          <div className="min-h-screen bg-black pt-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </BrowseLayout>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
