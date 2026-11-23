import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, externalLinkProps } from "@/lib/utils";

// Rounded rectangles, not pills: 16px radius, 60px tall at the default size.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2.5 font-bold whitespace-nowrap transition-[transform,background-color,box-shadow,color] duration-200 ease-spring select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-raised hover:-translate-y-0.5",
        secondary: "bg-panel text-foreground hover:bg-panel-strong",
        ghost: "text-foreground hover:bg-panel",
      },
      size: {
        sm: "h-10 rounded-xl px-3.5 text-[15px] [&_svg]:size-4.5",
        md: "h-13 rounded-2xl px-5 text-[17px] [&_svg]:size-5",
        lg: "h-15 rounded-2xl px-6 text-lg [&_svg]:size-5.5",
        icon: "size-11 rounded-xl [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

interface ButtonLinkProps extends ComponentProps<typeof Link>, ButtonVariants {}

export function ButtonLink({ className, variant, size, href, ...props }: ButtonLinkProps): ReactNode {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
      {...(typeof href === "string" ? externalLinkProps(href) : {})}
      {...props}
    />
  );
}

// The small dark price tag that sits inside a secondary button ("App Store  Free").
export function PriceChip({ className, ...props }: ComponentProps<"span">): ReactNode {
  return (
    <span
      className={cn(
        "bg-primary text-primary-foreground rounded-lg px-2 py-1 text-[13px] leading-none font-bold",
        className,
      )}
      {...props}
    />
  );
}
