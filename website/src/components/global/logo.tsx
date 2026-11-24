import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LATEST_RELEASE } from "@/modules/changelog/content";
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
      className={cn("rounded-icon ring-border size-9 ring-1", className)}
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
        aria-label={`v${LATEST_RELEASE.version} changelog`}
        className="text-faint-foreground hover:text-foreground -mt-4 rounded-md border px-1 py-px text-chip leading-tight font-bold transition-colors"
      >
        v{LATEST_RELEASE.version}
      </Link>
    </div>
  );
}
