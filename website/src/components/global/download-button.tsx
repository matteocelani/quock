import type { ReactNode } from "react";
import { ButtonLink, PriceChip } from "@/components/ui/button";
import { DownloadIcon, PhoneIcon } from "@/components/ui/icons";
import { SITE } from "@/lib/site";

// A labelled button rather than Apple's badge artwork, which comes with its own usage rules.
export function DownloadButton({ className }: { className?: string }): ReactNode {
  return (
    <ButtonLink href={SITE.appStoreUrl} className={className}>
      <PhoneIcon />
      Download for iPhone
    </ButtonLink>
  );
}

// Secondary CTA with a small price tag; for Quock the tag reads "Free".
export function AppStoreButton({ className }: { className?: string }): ReactNode {
  return (
    <ButtonLink href={SITE.appStoreUrl} variant="secondary" className={className} aria-label="App Store, free">
      <DownloadIcon className="text-faint-foreground" />
      App Store
      <PriceChip>Free</PriceChip>
    </ButtonLink>
  );
}
