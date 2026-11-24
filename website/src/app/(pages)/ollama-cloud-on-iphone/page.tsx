import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Lead } from "@/components/ui/heading";
import { DownloadButton } from "@/components/global/download-button";
import { JsonLd } from "@/components/global/json-ld";
import { GuideChats, GuideSteps, GuideTips } from "@/components/guide/guide-lists";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { GUIDE_DESCRIPTION, GUIDE_HEADLINE, GUIDE_INTRO, GUIDE_TITLE, GUIDE_UPDATED } from "@/modules/guide/content";
import { HOW_TO_JSON_LD } from "@/modules/guide/schema";
import { pageMetadata } from "@/lib/metadata";
import { PATHS } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: GUIDE_TITLE,
  description: GUIDE_DESCRIPTION,
  path: PATHS.guide,
});

export default function GuidePage(): ReactNode {
  return (
    <PageColumn>
      <JsonLd data={HOW_TO_JSON_LD} />
      <PageIntro title={GUIDE_HEADLINE} updated={GUIDE_UPDATED} path={PATHS.guide} />
      <Lead>{GUIDE_INTRO}</Lead>
      <h2 className="sr-only">{GUIDE_TITLE}</h2>
      <GuideSteps />
      <DownloadButton className="mt-12" />
      <GuideTips />
      <GuideChats />
    </PageColumn>
  );
}
