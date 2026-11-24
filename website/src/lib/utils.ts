import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { SITE } from "@/lib/site";

interface ExternalLinkProps {
  target?: string;
  rel?: string;
}

// Our @theme names, so tailwind-merge reads text-ui as a size (not a colour) and keeps both classes.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display-sm", "section-sm", "section", "lead", "body", "ui", "mock", "chip", "tag"],
      shadow: ["raised", "card", "float"],
      radius: ["tile", "stage", "icon"],
      tracking: ["display", "section", "feature", "title"],
      leading: ["display", "section", "lead"],
      ease: ["spring", "glide"],
      container: ["reading", "content", "hero", "stage"],
    },
  },
});

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
