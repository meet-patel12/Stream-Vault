"use client";

import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useThemeStore } from "@/store/theme-store";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "glass" | "shimmer" | "glow";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  soundType?: "click" | "switch" | "navigate" | "success";
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading,
  leftIcon,
  rightIcon,
  className,
  disabled,
  soundType = "click",
  onClick,
  ...props
}: ButtonProps) {
  const { playMicroInteraction } = useThemeStore();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    playMicroInteraction(soundType);
    onClick?.(e);
  };

  const base =
    "inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 select-none relative overflow-hidden group";

  const variants = {
    primary:
      "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30 hover:shadow-red-700/50 hover:scale-102",
    secondary:
      "bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/10 hover:border-white/20",
    ghost:
      "bg-transparent hover:bg-white/10 text-white",
    danger:
      "bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white shadow-lg shadow-red-950/50",
    glass:
      "bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/20 hover:border-white/40 shadow-xl",
    shimmer:
      "bg-gradient-to-r from-red-600 via-rose-500 to-red-600 bg-[length:200%_auto] hover:bg-right text-white shadow-lg shadow-red-900/40 transition-[background-position] duration-500",
    glow:
      "bg-white text-black hover:bg-zinc-100 shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)] font-extrabold",
  };

  const sizes = {
    sm: "text-xs px-3.5 py-2",
    md: "text-sm px-5 py-2.5",
    lg: "text-base px-7 py-3.5",
  };

  return (
    <button
      data-focusable="true"
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      onClick={handleClick}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}
