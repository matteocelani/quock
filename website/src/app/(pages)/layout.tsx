import type { Viewport } from "next";
import type { PropsWithChildren, ReactNode } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { THEME_COLOR } from "@/lib/site";

// Reading pages are dark, so the browser chrome and first paint must be dark too.
export const viewport: Viewport = {
  themeColor: THEME_COLOR.dark,
  colorScheme: "dark",
};

export default function PagesLayout({ children }: PropsWithChildren): ReactNode {
  return <SiteShell theme="dark">{children}</SiteShell>;
}
