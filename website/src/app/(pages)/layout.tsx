import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/site-shell";

// FAQs, changelog, guide and privacy read in the dark, set apart from the light home page.
export default function PagesLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return <SiteShell theme="dark">{children}</SiteShell>;
}
