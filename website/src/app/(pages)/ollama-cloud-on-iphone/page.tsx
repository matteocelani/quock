import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Heading, Lead } from "@/components/ui/heading";
import { DownloadButton } from "@/components/global/download-button";
import { JsonLd } from "@/components/global/json-ld";
import { GuideSteps, GuideTips } from "@/components/guide/guide-lists";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { GUIDE_CHATS, GUIDE_HEADLINE, GUIDE_INTRO, GUIDE_TIPS_TITLE, GUIDE_TITLE, GUIDE_UPDATED } from "@/modules/guide/content";
import { HOW_TO_JSON_LD } from "@/modules/guide/schema";
import { pageMetadata } from "@/lib/metadata";
import { PATHS } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: GUIDE_TITLE,
  description:
    "Use Ollama Cloud models on your iPhone in four steps: get an ollama.com account, download Quock, sign in once, pick a model and type. Free, private, open source.",
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
      <Heading as="h2" size="subsection" className="mt-24">
        {GUIDE_TIPS_TITLE}
      </Heading>
      <GuideTips />
      <Heading as="h2" size="subsection" className="mt-24">
        {GUIDE_CHATS.title}
      </Heading>
      <p className="text-muted-foreground text-body mt-4 leading-relaxed text-pretty">{GUIDE_CHATS.body}</p>
    </PageColumn>
  );
}
