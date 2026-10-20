"use client";

import { clsx } from "clsx";

interface SkeletonProps {
  className?: string;
  variant?: "pulse" | "shimmer";
}

/**
 * Base high-performance shimmering skeleton element
 */
export function Skeleton({ className, variant = "shimmer" }: SkeletonProps) {
  if (variant === "shimmer") {
    return (
      <div className={clsx("shimmer-wrapper rounded-md", className)}>
        <div className="shimmer-wave" />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-white/10 dark:bg-white/10 light:bg-black/10",
        className
      )}
    />
  );
}

/**
 * Poster/Landscape Card Skeleton with optional badge placeholder
 */
export function ContentCardSkeleton({
  aspect = "portrait",
  size = "md",
}: {
  aspect?: "portrait" | "landscape";
  size?: "sm" | "md" | "lg";
}) {
  const widthClasses = {
    sm: aspect === "portrait" ? "w-32 sm:w-40" : "w-44 sm:w-56",
    md: aspect === "portrait" ? "w-40 sm:w-48" : "w-52 sm:w-64",
    lg: aspect === "portrait" ? "w-48 sm:w-60" : "w-64 sm:w-80",
  };

  return (
    <div className={clsx("flex-shrink-0 select-none", widthClasses[size])}>
      <Skeleton
        className={clsx(
          "w-full rounded-xl overflow-hidden",
          aspect === "portrait" ? "aspect-[2/3]" : "aspect-[16/10]"
        )}
      />
      <div className="mt-2 space-y-1.5 px-0.5">
        <Skeleton className="h-3.5 w-4/5 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-2.5 w-1/3 rounded" />
          <Skeleton className="h-2.5 w-1/4 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Cinematic Hero Banner Skeleton
 */
export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[75vh] min-h-[550px] max-h-[820px] bg-zinc-950 overflow-hidden">
      <Skeleton className="w-full h-full rounded-none" />
      {/* Dark gradient vignette over skeleton */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent pointer-events-none" />

      {/* Hero text & button placeholders */}
      <div className="absolute bottom-16 sm:bottom-20 left-4 sm:left-12 max-w-2xl space-y-4 z-10">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 sm:h-14 w-72 sm:w-[480px] rounded-lg" />
        <Skeleton className="h-4 w-60 sm:w-80 rounded" />
        <div className="space-y-2 pt-1">
          <Skeleton className="h-3.5 w-full sm:w-[500px] rounded" />
          <Skeleton className="h-3.5 w-4/5 sm:w-[420px] rounded" />
        </div>
        <div className="flex items-center gap-3 pt-3">
          <Skeleton className="h-12 w-32 sm:w-36 rounded-xl" />
          <Skeleton className="h-12 w-36 sm:w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Row Carousel Skeleton with row title
 */
export function ContentRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mb-10 px-4 sm:px-12 py-2">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-7 w-52 rounded-lg" />
        <Skeleton className="h-4 w-20 rounded hidden sm:block" />
      </div>
      <div className="flex gap-4 sm:gap-5 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <ContentCardSkeleton key={i} aspect="landscape" size="md" />
        ))}
      </div>
    </div>
  );
}

/**
 * Top 10 Hallmarks Skeleton
 */
export function Top10Skeleton() {
  return (
    <div className="mb-10 px-4 sm:px-12 py-2">
      <Skeleton className="h-7 w-64 rounded-lg mb-4" />
      <div className="flex gap-6 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center flex-shrink-0">
            <Skeleton className="w-16 h-28 rounded-md -mr-4 opacity-40" />
            <ContentCardSkeleton aspect="landscape" size="md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Responsive Catalog Grid Skeleton (for Movies, Series, Library)
 */
export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-full">
          <Skeleton className="w-full aspect-[16/10] rounded-xl" />
          <div className="mt-2 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <Skeleton className="h-2.5 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Modern Dashboard Chart Skeleton
 */
export function DashboardChartSkeleton() {
  return (
    <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <Skeleton className="w-full h-56 rounded-xl" />
      <div className="flex justify-between pt-2">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
    </div>
  );
}

/**
 * Admin Table Skeleton
 */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden p-4 space-y-3">
      <Skeleton className="h-10 w-full rounded-xl" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-14 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
