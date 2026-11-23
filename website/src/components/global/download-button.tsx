import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { DownloadIcon, PhoneIcon } from "@/components/ui/icons";
import { SITE } from "@/lib/site";

interface DownloadButtonProps {
  className?: string;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
}

interface AppStoreButtonProps {
  className?: string;
}

// One label and one link for every download CTA. It is a labelled button rather than Apple's badge
// artwork, which comes with its own usage rules.
export function DownloadButton({ className, variant = "primary", size = "lg" }: DownloadButtonProps): ReactNode {
  return (
    <ButtonLink href={SITE.appStoreUrl} variant={variant} size={size} className={className}>
      <PhoneIcon />
      Download for iPhone
    </ButtonLink>
  );
}

// The quieter second CTA carries the price, so "free" is visible before the store opens.
export function AppStoreButton({ className }: AppStoreButtonProps): ReactNode {
  return (
    <ButtonLink href={SITE.appStoreUrl} variant="secondary" className={className} aria-label="App Store, free">
      <DownloadIcon className="text-faint-foreground" />
      App Store
      <span className="bg-primary text-primary-foreground rounded-lg px-2 py-1 text-[13px] leading-none font-bold">
        Free
      </span>
    </ButtonLink>
  );
}
