import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn, externalLinkProps } from "@/lib/utils";

interface TextLinkProps extends ComponentProps<typeof Link> {
  href: string;
}

// Links inside prose: underlined in the accent, never coloured buttons.
export function TextLink({ className, href, ...props }: TextLinkProps): ReactNode {
  return (
    <Link
      href={href}
      className={cn(
        "text-foreground decoration-accent font-semibold underline decoration-2 underline-offset-4",
        className,
      )}
      {...externalLinkProps(href)}
      {...props}
    />
  );
}
