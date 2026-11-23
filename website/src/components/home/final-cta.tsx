import type { ReactNode } from "react";
import { Caption } from "@/components/home/typography";
import { PhoneIcon } from "@/components/ui/icons";
import { DownloadButton } from "@/components/global/download-button";
import { SITE } from "@/lib/site";

export function FinalCta(): ReactNode {
  return (
    <section aria-label="Download" className="reveal flex flex-col items-center gap-5 px-5 pt-24 sm:pt-32">
      <DownloadButton />
      <Caption>
        <PhoneIcon className="size-4" />
        iOS {SITE.minimumIos}+ · Free · Sign in with ollama.com
      </Caption>
    </section>
  );
}
