import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

interface SiteShellProps {
  theme: "light" | "dark";
  children: ReactNode;
}

// One wrapper per theme: the light home and the dark inner pages share the same chrome.
export function SiteShell({ theme, children }: SiteShellProps): ReactNode {
  return (
    <div data-theme={theme} className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
