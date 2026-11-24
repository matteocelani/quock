import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { SITE } from "@/lib/site";
import { THEME_TOKENS } from "@/lib/theme";

interface ExternalLinkProps {
  target?: string;
  rel?: string;
}

const twMerge = extendTailwindMerge({ extend: { theme: THEME_TOKENS } });

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString();
}

// Links that leave the site open in a new tab without handing it window.opener.
export function externalLinkProps(href: string): ExternalLinkProps {
  return /^https?:\/\//.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};
}
