import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PATHS, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

// The real app icon, so the site and the Home Screen look like the same product.
export function AppIcon({ className }: LogoProps): ReactNode {
  return (
    <Image
      src="/app-icon.png"
      alt=""
      width={72}
      height={72}
      className={cn("size-9 rounded-[22%] shadow-[0_0_0_1px_var(--border)]", className)}
      preload
    />
  );
}

// The version tag links to the changelog, so "what's new" is one tap from every page.
export function Wordmark({ className }: LogoProps): ReactNode {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Link href={PATHS.home} className="flex items-center gap-2.5 rounded-xl" aria-label={`${SITE.name} home`}>
        <AppIcon />
        <span className="text-xl font-bold tracking-[-0.02em]">{SITE.name}</span>
      </Link>
      <Link
        href={PATHS.changelog}
        aria-label={`v${SITE.version} changelog`}
        className="text-faint-foreground hover:text-foreground -mt-4 rounded-md border px-1 py-px text-[11px] leading-tight font-bold transition-colors"
      >
        v{SITE.version}
      </Link>
    </div>
  );
}
