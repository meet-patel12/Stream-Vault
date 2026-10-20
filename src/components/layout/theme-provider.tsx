"use client";

import { useEffect } from "react";
import { initializeTheme } from "@/store/theme-store";
import { SpatialNavigationController } from "./spatial-navigation";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <>
      <SpatialNavigationController />
      {children}
    </>
  );
}
