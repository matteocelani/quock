import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The type ramp: 96px hero, 70px section, 30px feature, 24px card (see .agent/design.md).
const headingVariants = cva("font-bold text-balance", {
  variants: {
    size: {
      display: "text-[2.75rem] leading-[1.02] tracking-[-0.03em] sm:text-7xl lg:text-8xl lg:leading-none",
      section: "text-[2.5rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl lg:text-[4.375rem]",
      feature: "text-2xl leading-tight tracking-[-0.015em] sm:text-[1.875rem]",
      card: "text-xl leading-snug tracking-[-0.01em] sm:text-2xl",
    },
  },
  defaultVariants: { size: "section" },
});

type HeadingTag = "h1" | "h2" | "h3";

interface HeadingProps extends ComponentProps<"h2">, VariantProps<typeof headingVariants> {
  as?: HeadingTag;
}

export function Heading({ as: Tag = "h2", size, className, ...props }: HeadingProps): ReactNode {
  return <Tag className={cn(headingVariants({ size }), className)} {...props} />;
}

// The highlighter stroke behind one word of a headline.
export function Marker({ className, ...props }: ComponentProps<"span">): ReactNode {
  return <span className={cn("marker", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">): ReactNode {
  return <p className={cn("text-xl font-bold tracking-[-0.01em] sm:text-2xl", className)} {...props} />;
}

// Section subhead: bold and dark, not muted, so it reads as part of the headline.
export function Lead({ className, ...props }: ComponentProps<"p">): ReactNode {
  return (
    <p
      className={cn("text-lg leading-snug font-bold tracking-[-0.01em] text-pretty sm:text-[1.4375rem] sm:leading-[1.35]", className)}
      {...props}
    />
  );
}

// Small bold caption under a CTA or a stage ("iOS 15.1 or later", "Psst… tap above").
export function Caption({ className, ...props }: ComponentProps<"p">): ReactNode {
  return (
    <p
      className={cn("text-faint-foreground inline-flex items-center gap-1.5 text-sm font-bold", className)}
      {...props}
    />
  );
}
