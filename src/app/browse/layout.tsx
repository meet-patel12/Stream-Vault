import type { ReactNode } from "react";
import { BrowseLayout } from "@/components/layout/browse-layout";

export default function Layout({ children }: { children: ReactNode }) {
  return <BrowseLayout>{children}</BrowseLayout>;
}
