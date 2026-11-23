import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Heading, Lead } from "@/components/ui/heading";
import { DownloadButton } from "@/components/global/download-button";
import { JsonLd } from "@/components/global/json-ld";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import {
  GUIDE_CHATS,
  GUIDE_HEADLINE,
  GUIDE_INTRO,
  GUIDE_STEPS,
  GUIDE_TIPS,
  GUIDE_TIPS_TITLE,
  GUIDE_TITLE,
  GUIDE_UPDATED,
} from "@/modules/guide/content";
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
      <ol className="mt-12 space-y-10">
        {GUIDE_STEPS.map((step, index) => (
          <li key={step.title} id={`step-${index + 1}`} className="flex scroll-mt-28 gap-5">
            <span className="bg-panel text-foreground flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold">
              {index + 1}
            </span>
            <div>
              <h3 className="text-lg font-bold tracking-[-0.01em] sm:text-2xl">{step.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-[17px] leading-relaxed text-pretty">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <DownloadButton className="mt-12" />

      <Heading as="h2" size="card" className="mt-24 text-3xl sm:text-4xl">
        {GUIDE_TIPS_TITLE}
      </Heading>
      <ul className="mt-6 divide-y">
        {GUIDE_TIPS.map((tip) => (
          <li key={tip.title} className="py-5">
            <h3 className="text-lg font-bold tracking-[-0.01em]">{tip.title}</h3>
            <p className="text-muted-foreground mt-1 text-[17px] leading-relaxed text-pretty">{tip.body}</p>
          </li>
        ))}
      </ul>

      <Heading as="h2" size="card" className="mt-24 text-3xl sm:text-4xl">
        {GUIDE_CHATS.title}
      </Heading>
      <p className="text-muted-foreground mt-4 text-[17px] leading-relaxed text-pretty">{GUIDE_CHATS.body}</p>
    </PageColumn>
  );
}
