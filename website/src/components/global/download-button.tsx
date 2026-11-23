import type { ReactNode } from "react";
import { ButtonLink, PriceChip } from "@/components/ui/button";
import { DownloadIcon, PhoneIcon } from "@/components/ui/icons";
import { SITE } from "@/lib/site";

interface CtaProps {
  className?: string;
}

// A labelled button rather than Apple's badge artwork, which comes with its own usage rules.
export function DownloadButton({ className }: CtaProps): ReactNode {
  return (
    <ButtonLink href={SITE.appStoreUrl} className={className}>
      <PhoneIcon />
      Download for iPhone
    </ButtonLink>
  );
}

// The quieter second CTA carries the price, so "free" is visible before the store opens.
export function AppStoreButton({ className }: CtaProps): ReactNode {
  return (
    <ButtonLink href={SITE.appStoreUrl} variant="secondary" className={className} aria-label="App Store, free">
      <DownloadIcon className="text-faint-foreground" />
      App Store
      <PriceChip>Free</PriceChip>
    </ButtonLink>
  );
}
