import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// The section label above a home headline: it names the topic so the headline can play.
export function Eyebrow({ className, ...props }: ComponentProps<"p">): ReactNode {
  return <p className={cn("text-xl font-bold tracking-[-0.01em] sm:text-2xl", className)} {...props} />;
}

// Facts under a CTA or a stage stay faint, so they inform without competing with the button.
export function Caption({ className, ...props }: ComponentProps<"p">): ReactNode {
  return (
    <p
      className={cn("text-faint-foreground inline-flex items-center gap-1.5 text-sm font-bold", className)}
      {...props}
    />
  );
}
