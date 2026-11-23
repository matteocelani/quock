import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/site-shell";

export default function HomeLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return <SiteShell theme="light">{children}</SiteShell>;
}
