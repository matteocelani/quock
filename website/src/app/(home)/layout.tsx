import type { PropsWithChildren, ReactNode } from "react";
import { SiteShell } from "@/components/layout/site-shell";

export default function HomeLayout({ children }: PropsWithChildren): ReactNode {
  return <SiteShell theme="light">{children}</SiteShell>;
}
