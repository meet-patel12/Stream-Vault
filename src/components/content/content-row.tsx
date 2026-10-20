"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingUp, Sparkles, Award } from "lucide-react";
import { ContentCard } from "./content-card";
import { ContentCardSkeleton } from "@/components/ui/skeleton";
import type { ContentItem } from "@/types";
import { clsx } from "clsx";

interface ContentRowProps {
  title: string;
  items: (ContentItem & { watchProgress?: { progressSeconds: number; totalSeconds: number | null } })[];
  isLoading?: boolean;
  showProgress?: boolean;
  isTop10?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ContentRow({
  title,
  items,
  isLoading = false,
  showProgress = false,
  isTop10 = false,
  size = "md",
}: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 20);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
  }, []);

  const scroll = useCallback(
    (dir: "left" | "right") => {
      if (!scrollRef.current) return;
      const amount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: dir === "left" ? -amount : amount,
        behavior: "smooth",
      });
      setTimeout(updateScrollState, 400);
    },
    [updateScrollState]
  );

  useEffect(() => {
    updateScrollState();
  }, [items, updateScrollState]);

  if (isLoading) {
    return (
      <div className="mb-10 px-4 sm:px-12">
        <div className="mb-4 h-7 w-56 bg-zinc-800/80 rounded-lg animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <ContentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <motion.div
      className="mb-10 group/row relative"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Row Header */}
      <div className="flex items-center justify-between px-4 sm:px-12 mb-3">
        <div className="flex items-center gap-2.5">
          {isTop10 && (
            <div className="p-1 rounded-md bg-red-600/20 text-red-500 border border-red-500/30">
              <Award size={18} />
            </div>
          )}
          <h2 className="text-white text-lg sm:text-2xl font-black tracking-tight flex items-center gap-2 group-hover:text-red-500 transition-colors cursor-pointer">
            {title}
            <ChevronRight
              size={18}
              className="text-red-500 opacity-0 group-hover/row:opacity-100 transition-all -translate-x-2 group-hover/row:translate-x-0"
            />
          </h2>
        </div>
        <span className="text-zinc-500 text-xs font-semibold tracking-wider uppercase hidden sm:block">
          Explore All ({items.length})
        </span>
      </div>

      {/* Scrollable Container with Left/Right Buttons */}
      <div className="relative">
        {/* Left Arrow Button */}
        <button
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          className={clsx(
            "absolute left-0 top-0 bottom-0 z-30 w-12 sm:w-16 bg-gradient-to-r from-black/90 via-black/50 to-transparent flex items-center justify-center transition-all duration-300",
            canScrollLeft ? "opacity-0 group-hover/row:opacity-100 hover:scale-110" : "opacity-0 pointer-events-none"
          )}
          aria-label="Scroll row left"
        >
          <div className="w-10 h-10 rounded-full bg-zinc-900/90 border border-white/20 text-white flex items-center justify-center shadow-2xl hover:bg-red-600 hover:border-red-500 transition-all">
            <ChevronLeft size={22} />
          </div>
        </button>

        {/* Content Strip */}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-hide px-4 sm:px-12 py-3"
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((item, idx) => {
            if (isTop10) {
              return (
                <div key={`top10-wrapper-${item.id}-${idx}`} className="flex items-center flex-shrink-0 relative group/top10">
                  {/* Big Number Typography */}
                  <div className="relative select-none pointer-events-none -mr-4 sm:-mr-7 z-0 flex items-center">
                    <span
                      className="text-[95px] sm:text-[145px] font-black leading-none tracking-tighter"
                      style={{
                        fontFamily: "'Arial Black', 'Impact', sans-serif",
                        WebkitTextStroke: "4px #595959",
                        color: "#050505",
                        filter: "drop-shadow(0 0 10px rgba(0,0,0,0.8))",
                      }}
                    >
                      {idx + 1}
                    </span>
                  </div>
                  {/* Card overlapping the right side of the number */}
                  <div className="relative z-10">
                    <ContentCard
                      key={`top10-card-${item.id}-${idx}`}
                      item={item}
                      size={size}
                      showProgress={showProgress}
                      rank={idx + 1}
                    />
                  </div>
                </div>
              );
            }

            return (
              <ContentCard
                key={`standard-card-${item.id}-${idx}`}
                item={item}
                size={size}
                showProgress={showProgress}
              />
            );
          })}
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          className={clsx(
            "absolute right-0 top-0 bottom-0 z-30 w-12 sm:w-16 bg-gradient-to-l from-black/90 via-black/50 to-transparent flex items-center justify-center transition-all duration-300",
            canScrollRight ? "opacity-0 group-hover/row:opacity-100 hover:scale-110" : "opacity-0 pointer-events-none"
          )}
          aria-label="Scroll row right"
        >
          <div className="w-10 h-10 rounded-full bg-zinc-900/90 border border-white/20 text-white flex items-center justify-center shadow-2xl hover:bg-red-600 hover:border-red-500 transition-all">
            <ChevronRight size={22} />
          </div>
        </button>
      </div>
    </motion.div>
  );
}
