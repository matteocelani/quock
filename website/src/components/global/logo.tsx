import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function AppIcon({ className }: { className?: string }): ReactNode {
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

// App icon, name and a superscript version tag that links to the changelog.
export function Wordmark({ className }: { className?: string }): ReactNode {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Link href="/" className="flex items-center gap-2.5 rounded-xl" aria-label="Quock home">
        <AppIcon />
        <span className="text-xl font-bold tracking-[-0.02em]">Quock</span>
      </Link>
      <Link
        href="/changelog"
        aria-label={`v${SITE.version} changelog`}
        className="text-faint-foreground hover:text-foreground -mt-4 rounded-md border px-1 py-px text-[11px] leading-tight font-bold transition-colors"
      >
        v{SITE.version}
      </Link>
    </div>
  );
}
