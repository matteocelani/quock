import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, externalLinkProps } from "@/lib/utils";

// Rounded rectangles, not pills: the shape iOS uses for prominent buttons, 60px tall by default.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2.5 font-bold whitespace-nowrap transition-[scale,translate,background-color,box-shadow,color] duration-200 ease-spring select-none active:scale-97 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-raised hover:-translate-y-0.5",
        secondary: "bg-panel text-foreground hover:bg-panel-strong",
      },
      size: {
        md: "h-13 rounded-2xl px-5 text-body [&_svg]:size-5",
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
