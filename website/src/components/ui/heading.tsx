import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The type ramp: 96px hero, 70px section, 36px subsection, 30px feature, 24px card and item (see design.md).
const headingVariants = cva("font-bold text-balance", {
  variants: {
    size: {
      display: "text-[2.75rem] leading-[1.02] tracking-[-0.03em] sm:text-7xl lg:text-8xl lg:leading-none",
      section: "text-[2.5rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl lg:text-[4.375rem]",
      feature: "text-2xl leading-tight tracking-[-0.015em] sm:text-[1.875rem]",
      card: "text-xl leading-snug tracking-title sm:text-2xl",
      subsection: "text-3xl leading-tight tracking-[-0.015em] sm:text-4xl",
      item: "text-lg leading-snug tracking-title sm:text-2xl",
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

// A headline gets one accent and this is it, so the marker is a component, not a class to sprinkle.
export function Marker({ className, ...props }: ComponentProps<"span">): ReactNode {
  return <span className={cn("marker", className)} {...props} />;
}


// Section subhead: bold and dark, not muted, so it reads as part of the headline.
export function Lead({ className, ...props }: ComponentProps<"p">): ReactNode {
  return (
    <p
      className={cn("text-lg leading-snug font-bold tracking-title text-pretty sm:text-[1.4375rem] sm:leading-[1.35]", className)}
      {...props}
    />
  );
}
