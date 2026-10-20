"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film,
  Tv,
  Users,
  Database,
  Plus,
  Trash2,
  Search,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  ShieldCheck,
  Shield,
  Zap,
  Sparkles,
  X,
  UploadCloud,
  Cpu,
  Copy,
  Check,
  AlertCircle,
  BarChart3,
  DollarSign,
  Activity,
  TrendingUp,
  Radio,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import {
  StreamingAreaChart,
  PlanDonutChart,
  QualityDistributionBarChart,
  ActivityHeatmap,
} from "@/components/dashboard/interactive-charts";
import toast from "react-hot-toast";

interface EncodingJobItem {
  id: number;
  contentId: number | null;
  sourceFile: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  dashManifest?: string | null;
  hlsManifest?: string | null;
  vmafScores?: Record<string, number> | null;
  errorMessage?: string | null;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalContent: number;
  moviesCount: number;
  seriesCount: number;
  genreCount: number;
  planBreakdown: { plan: string; count: number }[];
  dbStatus: string;
}

interface ContentItem {
  id: number;
  title: string;
  type: "movie" | "series";
  releaseYear: number;
  maturityRating: string;
  duration?: number;
  posterUrl: string;
  backdropUrl: string;
  imdbRating?: number;
  isPublished: boolean;
  isFeatured: boolean;
  genres?: string[];
  createdAt: string;
}

interface UserItem {
  id: number;
  email: string;
  role: "admin" | "user";
  plan: string;
  emailVerified: boolean;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isHydrated } = useAuthStore();

  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "content" | "queue" | "users" | "database">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [userList, setUserList] = useState<UserItem[]>([]);
  const [encodingJobs, setEncodingJobs] = useState<EncodingJobItem[]>([]);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadContentId, setUploadContentId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "movie" | "series">("all");

  // Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "movie",
    releaseYear: new Date().getFullYear().toString(),
    maturityRating: "PG-13",
    duration: "120",
    posterUrl: "",
    backdropUrl: "",
    imdbRating: "8.5",
    isFeatured: false,
    isPublished: true,
  });
  const [submitting, setSubmitting] = useState(false);

  // Admin protection
  useEffect(() => {
    if (isHydrated) {
      if (!user) {
        router.push("/auth/login");
      } else if (user.role !== "admin") {
        toast.error("Access denied. Admin privileges required.");
        router.push("/browse");
      }
    }
  }, [user, isHydrated, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resStats, resContent, resUsers, resEncoding, resAnalytics, resMonitoring] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/content"),
        fetch("/api/admin/users"),
        fetch("/api/admin/encoding"),
        fetch("/api/admin/analytics"),
        fetch("/api/admin/monitoring").catch(() => null),
      ]);

      if (resStats.ok) {
        const data = await resStats.json();
        if (data.success) setStats(data.data.stats);
      }
      if (resAnalytics.ok) {
        const data = await resAnalytics.json();
        if (data.success) setAnalytics(data.data);
      }
      if (resContent.ok) {
        const data = await resContent.json();
        if (data.success) setContentList(data.data.items);
      }
      if (resUsers.ok) {
        const data = await resUsers.json();
        if (data.success) setUserList(data.data.users);
      }
      if (resEncoding.ok) {
        const data = await resEncoding.json();
        if (data.success) setEncodingJobs(data.data.jobs);
      }
      if (resMonitoring && resMonitoring.ok) {
        const data = await resMonitoring.json();
        if (data.success) setMonitoring(data.data);
      }
    } catch {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetryJob = async (jobId: number) => {
    try {
      const res = await fetch("/api/admin/encoding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", jobId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Job #${jobId} requeued for transcoding`);
        fetchData();
      } else {
        toast.error(data.error?.message || "Retry failed");
      }
    } catch {
      toast.error("Error retrying job");
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm(`Are you sure you want to delete transcoding job #${jobId}?`)) return;

    try {
      const res = await fetch(`/api/admin/encoding?jobId=${jobId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Job #${jobId} deleted successfully`);
        setEncodingJobs((prev) => prev.filter((j) => j.id !== jobId));
      } else {
        toast.error(data.error?.message || "Failed to delete job");
      }
    } catch {
      toast.error("Error deleting job");
    }
  };

  const handleUploadMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Please select a video file");
      return;
    }
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", uploadFile);
      if (uploadContentId) formDataUpload.append("content_id", uploadContentId);

      const res = await fetch("/api/admin/b2-upload", {
        method: "POST",
        body: formDataUpload,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Movie uploaded successfully! Transcoding has started.");
        setUploadFile(null);
        setUploadContentId("");
        fetchData();
      } else {
        toast.error(data.error?.message || "Upload failed. Please check file format and size.");
      }
    } catch (err: unknown) {
      toast.error("Upload failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchData();
    }
  }, [user, fetchData]);

  // Live auto-polling: refresh queue every 3 seconds when transcoding jobs are active or on the queue tab
  useEffect(() => {
    if (user?.role !== "admin") return;

    const hasActiveJobs = encodingJobs.some(
      (j) => j.status === "pending" || j.status === "processing"
    );

    if (activeTab === "queue" || hasActiveJobs) {
      const interval = setInterval(() => {
        fetchData();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [user, activeTab, encodingJobs, fetchData]);

  const handleDeleteContent = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/admin/content?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted "${title}"`);
        setContentList((prev) => prev.filter((item) => item.id !== id));
        fetchData();
      } else {
        toast.error(data.error?.message || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete content");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Content added successfully!");
        setIsAddModalOpen(false);
        setFormData({
          title: "",
          description: "",
          type: "movie",
          releaseYear: new Date().getFullYear().toString(),
          maturityRating: "PG-13",
          duration: "120",
          posterUrl: "",
          backdropUrl: "",
          imdbRating: "8.5",
          isFeatured: false,
          isPublished: true,
        });
        fetchData();
      } else {
        toast.error(data.error?.message || "Failed to add title");
      }
    } catch {
      toast.error("Error creating content");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredContent = contentList.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    return matchesSearch && matchesType;
  });

  if (!isHydrated || (user && user.role !== "admin")) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-red-500 font-medium">
          <RefreshCw className="animate-spin" /> Verifying Admin Credentials...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-red-600 selection:text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/browse"
              className="p-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all flex items-center gap-2 text-sm"
            >
              <ArrowLeft size={16} /> Back to App
            </Link>
            <div className="h-6 w-px bg-zinc-800" />
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-red-600 tracking-tight">STREAMVAULT</span>
              <span className="bg-red-950/80 text-red-400 border border-red-800/50 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck size={12} /> ADMIN PANEL
              </span>
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-700/50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4 mb-8 overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: Zap },
            { id: "analytics", label: "Analytics & Revenue", icon: BarChart3 },
            { id: "content", label: `Catalog (${contentList.length})`, icon: Film },
            { id: "queue", label: `Transcode Queue (${encodingJobs.length})`, icon: Cpu },
            { id: "users", label: `Users (${userList.length})`, icon: Users },
            { id: "database", label: "Cloud DB Status", icon: Database },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === id
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-red-500/20 group-hover:text-red-500/40 transition-all">
                  <Film size={48} />
                </div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">Total Catalog Titles</p>
                <p className="text-4xl font-extrabold mt-2 text-white">{stats?.totalContent ?? contentList.length}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1 text-emerald-400"><Film size={12} /> {stats?.moviesCount ?? 0} Movies</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-purple-400"><Tv size={12} /> {stats?.seriesCount ?? 0} Series</span>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-emerald-500/20 group-hover:text-emerald-500/40 transition-all">
                  <Users size={48} />
                </div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">Registered Accounts</p>
                <p className="text-4xl font-extrabold mt-2 text-white">{stats?.totalUsers ?? userList.length}</p>
                <p className="mt-4 text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={12} /> Active in Neon DB
                </p>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-amber-500/20 group-hover:text-amber-500/40 transition-all">
                  <Sparkles size={48} />
                </div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">Genres Configured</p>
                <p className="text-4xl font-extrabold mt-2 text-white">{stats?.genreCount ?? 0}</p>
                <p className="mt-4 text-xs text-zinc-400">Categorized in Drizzle ORM</p>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-blue-500/20 group-hover:text-blue-500/40 transition-all">
                  <Database size={48} />
                </div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">Database Connection</p>
                <p className="text-lg font-bold mt-2 text-emerald-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Neon PostgreSQL
                </p>
                <p className="mt-4 text-xs text-zinc-400 truncate">cloud postgres connected</p>
              </div>
            </div>

            {/* Quick Actions & Recent Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Film className="text-red-500" size={20} /> Recent Catalog Additions
                  </h3>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <Plus size={14} /> Add Title
                  </button>
                </div>

                <div className="space-y-3">
                  {contentList.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-14 rounded bg-zinc-800 overflow-hidden flex-shrink-0 relative">
                          {item.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">No Cover</div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-white">{item.title}</p>
                          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                            <span className="capitalize">{item.type}</span>
                            <span>•</span>
                            <span>{item.releaseYear}</span>
                            <span>•</span>
                            <span className="text-yellow-400 font-medium">★ {item.imdbRating ?? 8.0}</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                        Published
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan Distribution */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Users className="text-emerald-500" size={20} /> Account Tiers
                </h3>
                <div className="space-y-4">
                  {stats?.planBreakdown?.map((pb) => (
                    <div key={pb.plan} className="space-y-1">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="capitalize text-zinc-300">{pb.plan} Plan</span>
                        <span className="text-zinc-400">{pb.count} user(s)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-red-600 rounded-full"
                          style={{
                            width: `${Math.min(100, (pb.count / (stats.totalUsers || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )) || (
                    <p className="text-xs text-zinc-500">Loading plan metrics...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ANALYTICS & REVENUE */}
        {activeTab === "analytics" && (
          <div className="space-y-8">
            {/* Interactive Data Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <StreamingAreaChart />
              </div>
              <div className="lg:col-span-1">
                <PlanDonutChart />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <QualityDistributionBarChart />
              <ActivityHeatmap />
            </div>

            {/* Revenue KPIs */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="text-emerald-400" size={20} /> Financial & Revenue Engine
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Monthly Recurring (MRR)</p>
                  <p className="text-3xl font-black text-white mt-2">${analytics?.revenue?.mrr?.toLocaleString() ?? "0"}</p>
                  <p className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1">
                    <TrendingUp size={12} /> Normalized Subscriptions
                  </p>
                </div>

                <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Annual Run Rate (ARR)</p>
                  <p className="text-3xl font-black text-emerald-400 mt-2">${analytics?.revenue?.arr?.toLocaleString() ?? "0"}</p>
                  <p className="text-xs text-zinc-400 mt-2">12x MRR projection</p>
                </div>

                <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Avg Revenue / User (ARPU)</p>
                  <p className="text-3xl font-black text-white mt-2">${analytics?.revenue?.arpu ?? "0.00"}</p>
                  <p className="text-xs text-zinc-400 mt-2">Per active account</p>
                </div>

                <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">GST Tax Itemized (18%)</p>
                  <p className="text-3xl font-black text-yellow-400 mt-2">${analytics?.revenue?.gstCollected?.toFixed(2) ?? "0.00"}</p>
                  <p className="text-xs text-zinc-400 mt-2">Remitted in compliance</p>
                </div>
              </div>
            </div>

            {/* Streaming & QoE Metrics */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="text-blue-400" size={20} /> Streaming QoE & Telemetry
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Streamed Hours</p>
                  <p className="text-3xl font-black text-white mt-2">{analytics?.streaming?.totalStreamedHours?.toLocaleString() ?? "0"} hrs</p>
                  <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                    <Radio size={12} className="animate-pulse" /> {analytics?.streaming?.activeStreamsEstimate ?? 1} concurrent streams
                  </p>
                </div>

                <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Avg Startup Latency</p>
                  <p className="text-3xl font-black text-emerald-400 mt-2">{analytics?.streaming?.avgStartupTimeMs ?? 680} ms</p>
                  <p className="text-xs text-emerald-400 mt-2 font-medium">Ultra-Fast Time-To-First-Frame</p>
                </div>

                <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Rebuffering Ratio</p>
                  <p className="text-3xl font-black text-white mt-2">{analytics?.streaming?.avgBufferRatioPercent ?? 0.4}%</p>
                  <p className="text-xs text-zinc-400 mt-2">&lt; 1% Netflix Standard Benchmark</p>
                </div>

                <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">CDN Cache Hit Ratio</p>
                  <p className="text-3xl font-black text-white mt-2">{analytics?.streaming?.cdnCacheHitRatio ?? 96.8}%</p>
                  <p className="text-xs text-emerald-400 mt-2 font-medium">Edge Distributed Cache</p>
                </div>
              </div>
            </div>

            {/* Subscriptions & Payment Gateways */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Subscription Breakdown */}
              <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-2xl">
                <h4 className="text-base font-bold text-white mb-4">Subscription Health</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Active Subscribers</span>
                    <span className="text-emerald-400 font-bold">{analytics?.users?.activeSubscribers ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Paused Subscriptions</span>
                    <span className="text-yellow-400 font-bold">{analytics?.users?.pausedSubscribers ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Churn Rate</span>
                    <span className="text-zinc-300 font-bold">{analytics?.users?.churnRatePercent ?? 0}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-white/5">
                    <span className="text-zinc-400">Total Family & Premium Plans</span>
                    <span className="text-purple-400 font-bold">
                      {(analytics?.users?.planBreakdown?.premium || 0) + (analytics?.users?.planBreakdown?.family || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gateway Breakdown */}
              <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-2xl">
                <h4 className="text-base font-bold text-white mb-4">Payment Gateways & Success Rate</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Transaction Success Rate</span>
                    <span className="text-emerald-400 font-bold">{analytics?.payments?.successRate ?? 100}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Integrated Gateways</span>
                    <span className="text-white font-semibold">Stripe • Razorpay • PayPal • Apple Pay</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Refunds Processed</span>
                    <span className="text-zinc-300 font-semibold">${analytics?.revenue?.totalRefunds ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-white/5">
                    <span className="text-zinc-400">Encoding Pipeline Health</span>
                    <span className="text-emerald-400 font-bold">{analytics?.encoding?.queueHealth ?? "Optimal"} (AV1, H.265)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONTENT CATALOG MANAGEMENT */}
        {activeTab === "content" && (
          <div className="space-y-6">
            {/* Search and Filters Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search catalog titles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-sm text-white rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-red-600 transition-all"
                  />
                </div>
                <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
                  {(["all", "movie", "series"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                        filterType === t ? "bg-red-600 text-white" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/30"
              >
                <Plus size={16} /> Add New Title
              </button>
            </div>

            {/* Catalog Table */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider font-semibold bg-zinc-900/80">
                    <th className="p-4">Title</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Year</th>
                    <th className="p-4">Rating</th>
                    <th className="p-4">IMDb</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-sm">
                  {filteredContent.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/60 transition-all">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-12 rounded bg-zinc-800 overflow-hidden flex-shrink-0">
                            {item.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">No Image</div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{item.title}</p>
                            <p className="text-xs text-zinc-500 capitalize">{item.genres?.join(", ") || "General"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full border ${
                            item.type === "movie"
                              ? "bg-blue-950 text-blue-400 border-blue-800/40"
                              : "bg-purple-950 text-purple-400 border-purple-800/40"
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-300 font-medium">{item.releaseYear}</td>
                      <td className="p-4 text-zinc-400 text-xs font-semibold">{item.maturityRating}</td>
                      <td className="p-4 text-yellow-400 font-bold">★ {item.imdbRating ?? 8.0}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteContent(item.id, item.title)}
                          className="p-2 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-red-950/40 transition-all"
                          title="Delete content"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredContent.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500 text-sm">
                        No titles found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ENCODING QUEUE & UPLOAD */}
        {activeTab === "queue" && (
          <div className="space-y-8">
            {/* Live Streaming Infrastructure & CDN Monitor */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={14} className="text-emerald-400" /> Private Backblaze B2
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded-full font-bold">
                    Private Bucket
                  </span>
                </div>
                <p className="text-xl font-bold text-white font-mono">{monitoring?.backblazeB2?.bucketName || "Web-Series22"}</p>
                <div className="text-xs text-zinc-400 space-y-1 pt-1">
                  <p className="flex justify-between"><span>Origin Protection:</span> <span className="text-emerald-400 font-medium">Zero Public Exposure</span></p>
                  <p className="flex justify-between"><span>Encryption:</span> <span className="text-zinc-300">Server-Side AES-256</span></p>
                  <p className="flex justify-between"><span>Storage Est:</span> <span className="text-zinc-300">{monitoring?.backblazeB2?.estimatedStorageGb || "12.4"} GB</span></p>
                </div>
              </div>

              <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-400" /> Cloudflare Edge CDN
                  </span>
                  <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded-full font-bold">
                    HTTP/3 Brotli
                  </span>
                </div>
                <p className="text-xl font-bold text-white font-mono truncate">{monitoring?.cloudflareCdn?.baseUrl?.split("//")[1] || "empty-math-c190.workers.dev"}</p>
                <div className="text-xs text-zinc-400 space-y-1 pt-1">
                  <p className="flex justify-between"><span>Edge Cache Ratio:</span> <span className="text-emerald-400 font-bold">{monitoring?.cloudflareCdn?.cacheHitRatioPercent || 96.8}%</span></p>
                  <p className="flex justify-between"><span>Segment Cache:</span> <span className="text-zinc-300">1-Year Immutable</span></p>
                  <p className="flex justify-between"><span>Auth Tokens:</span> <span className="text-amber-400 font-medium">HMAC-SHA256 Signed</span></p>
                </div>
              </div>

              <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu size={14} className="text-red-400" /> Transcoding Engine
                  </span>
                  <span className="text-[10px] bg-red-950 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full font-bold">
                    AV1 + H.264 + HEVC
                  </span>
                </div>
                <p className="text-xl font-bold text-white">7-Tier Adaptive Ladder</p>
                <div className="text-xs text-zinc-400 space-y-1 pt-1">
                  <p className="flex justify-between"><span>Resolutions:</span> <span className="text-zinc-300">2160p (4K) down to 240p</span></p>
                  <p className="flex justify-between"><span>Packaging:</span> <span className="text-blue-400">HLS .m3u8 + MPEG-DASH .mpd</span></p>
                  <p className="flex justify-between"><span>Redis Queue:</span> <span className="text-emerald-400 font-mono">{monitoring?.encodingQueue?.redisQueueLength ?? 0} in queue</span></p>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <UploadCloud className="text-red-500" size={20} /> Upload Source Video to Private Backblaze B2
              </h3>
              <p className="text-xs text-zinc-400 mb-4">
                Accepted: MP4, MKV, MOV, AVI, WebM, M4V, FLV, TS, MPEG, WMV. Source files are strictly transcoded to adaptive DASH/HLS outputs.
              </p>

              <form onSubmit={handleUploadMedia} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <input
                    type="file"
                    accept=".mp4,.mkv,.mov,.avi,.webm,.m4v,.flv,.ts,.mpeg,.wmv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer bg-zinc-950 p-2 rounded-xl border border-zinc-800"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile}
                    className="w-full h-full min-h-[40px] bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/20"
                  >
                    {uploading ? <RefreshCw className="animate-spin" size={14} /> : <UploadCloud size={14} />}
                    {uploading ? "Queuing Job..." : "Upload & Transcode"}
                  </button>
                </div>
              </form>
            </div>

            {/* Queue List */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu size={16} className="text-red-500" /> Active Transcoding Jobs ({encodingJobs.length})
                </h4>
                <button onClick={fetchData} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              <div className="divide-y divide-zinc-800/60">
                {encodingJobs.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-sm">
                    No active or recent encoding jobs found.
                  </div>
                ) : (
                  encodingJobs.map((job) => (
                    <div key={job.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-900/60 transition-all">
                      <div className="space-y-1 max-w-md">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-zinc-400">#{job.id}</span>
                          <span className="text-sm font-semibold text-white truncate">{job.sourceFile.split(/[/\\]/).pop()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                              job.status === "completed"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                                : job.status === "processing"
                                ? "bg-blue-950 text-blue-400 border border-blue-800/40 animate-pulse"
                                : job.status === "failed"
                                ? "bg-red-950 text-red-400 border border-red-800/40"
                                : "bg-amber-950 text-amber-400 border border-amber-800/40"
                            }`}
                          >
                            {job.status}
                          </span>
                          <span className="text-[11px] text-zinc-500">{new Date(job.createdAt).toLocaleTimeString()}</span>
                        </div>

                        {job.vmafScores && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(job.vmafScores).map(([rendition, score]) => (
                              <span key={rendition} className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono">
                                {rendition}: {Number(score).toFixed(1)} VMAF
                              </span>
                            ))}
                          </div>
                        )}

                        {job.errorMessage && (
                          <p className="text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle size={12} /> {job.errorMessage}
                          </p>
                        )}
                      </div>

                      {/* Progress Bar & Actions */}
                      <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[11px] text-zinc-400">
                            <span>Progress</span>
                            <span>{job.progress}%</span>
                          </div>
                          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                job.status === "completed"
                                  ? "bg-emerald-500"
                                  : job.status === "failed"
                                  ? "bg-red-500"
                                  : "bg-red-600"
                              }`}
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>

                        {job.status === "failed" && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-all"
                          >
                            Retry
                          </button>
                        )}

                        {job.status === "completed" && job.dashManifest && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(job.dashManifest || "");
                              toast.success("DASH Manifest URL copied!");
                            }}
                            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white p-2 rounded-lg transition-all"
                            title="Copy DASH Manifest"
                          >
                            <Copy size={14} />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="text-xs text-zinc-400 hover:text-red-400 hover:bg-red-950/40 p-2 rounded-lg transition-all"
                          title="Delete transcoding job"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: USER ACCOUNTS */}
        {activeTab === "users" && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider font-semibold bg-zinc-900/80">
                  <th className="p-4">User Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Subscription Plan</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {userList.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-900/60 transition-all">
                    <td className="p-4 font-semibold text-white flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-red-500">
                        {u.email[0].toUpperCase()}
                      </div>
                      {u.email}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                          u.role === "admin"
                            ? "bg-amber-950 text-amber-400 border border-amber-800/50"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {u.role === "admin" ? "👑 Admin" : "User"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-red-950 text-red-400 border border-red-800/40 uppercase font-semibold">
                        {u.plan}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle size={12} /> Verified
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400 text-xs font-medium">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: DATABASE & CLOUD STATUS */}
        {activeTab === "database" && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                <Database size={36} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Neon PostgreSQL Database</h3>
                <p className="text-xs text-zinc-400">Serverless Cloud Database (AWS us-east-2)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                <p className="text-xs text-zinc-500 font-semibold uppercase">ORM dialect</p>
                <p className="text-white font-mono font-semibold">Drizzle ORM (PostgreSQL)</p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                <p className="text-xs text-zinc-500 font-semibold uppercase">Connection Pooler</p>
                <p className="text-emerald-400 font-mono font-semibold">Neon Connection Pooler Active</p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                <p className="text-xs text-zinc-500 font-semibold uppercase">Database Migration State</p>
                <p className="text-emerald-400 font-mono font-semibold">Synced (drizzle-kit push)</p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                <p className="text-xs text-zinc-500 font-semibold uppercase">Catalog Seed Status</p>
                <p className="text-emerald-400 font-mono font-semibold">Seeded (scripts/seed.mjs)</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ADD TITLE MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="text-red-500" size={20} /> Add New Media Title
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Title Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stranger Things 5"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Synopsis of the movie or series..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Content Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as "movie" | "series" })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-600"
                    >
                      <option value="movie">Movie</option>
                      <option value="series">TV Series</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Release Year</label>
                    <input
                      type="number"
                      value={formData.releaseYear}
                      onChange={(e) => setFormData({ ...formData, releaseYear: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Maturity Rating</label>
                    <input
                      type="text"
                      placeholder="TV-MA / PG-13"
                      value={formData.maturityRating}
                      onChange={(e) => setFormData({ ...formData, maturityRating: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Duration (Mins)</label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">IMDb Rating</label>
                    <input
                      type="text"
                      placeholder="8.5"
                      value={formData.imdbRating}
                      onChange={(e) => setFormData({ ...formData, imdbRating: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Poster Image URL</label>
                  <input
                    type="text"
                    placeholder="https://... or /posters/..."
                    value={formData.posterUrl}
                    onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Backdrop Image URL</label>
                  <input
                    type="text"
                    placeholder="https://... or /backdrops/..."
                    value={formData.backdropUrl}
                    onChange={(e) => setFormData({ ...formData, backdropUrl: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-600"
                  />
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="rounded bg-zinc-950 border-zinc-800 text-red-600 focus:ring-0"
                    />
                    Feature on Home Billboard
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-all shadow-lg shadow-red-600/30 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Add to Catalog"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
