import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { PhoneIcon } from "@/components/ui/icons";
import { SITE } from "@/lib/site";

interface DownloadButtonProps {
  className?: string;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
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
