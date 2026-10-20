import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreamVault — Watch Movies & TV Shows Online",
  description:
    "Stream the latest blockbuster movies and binge-worthy TV series in 4K Ultra HD. Ultra-low latency, intelligent recommendations, and personalized streaming.",
  keywords: ["streaming", "movies", "tv shows", "watch online", "4K", "HDR", "entertainment"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#e50914",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-black text-white antialiased min-h-screen selection:bg-red-600 selection:text-white" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#18181b",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "14px",
              fontSize: "13px",
              fontWeight: "600",
              boxShadow: "0 20px 40px -15px rgba(0,0,0,0.8)",
            },
            success: {
              iconTheme: { primary: "#22c55e", secondary: "#000" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#000" },
            },
          }}
        />
      </body>
    </html>
  );
}
