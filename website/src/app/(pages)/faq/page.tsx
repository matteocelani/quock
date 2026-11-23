import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { TextLink } from "@/components/ui/text-link";
import { PrivacyTag } from "@/components/faq/privacy-tag";
import { JsonLd } from "@/components/global/json-ld";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { FAQ, FAQ_MORE, FAQ_UPDATED } from "@/modules/faq/content";
import { FAQ_JSON_LD } from "@/modules/faq/schema";
import { pageMetadata } from "@/lib/metadata";
import { PAGE_LABELS, PATHS, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: PAGE_LABELS.faq,
  description:
    "Answers about Quock, the independent iPhone app for Ollama Cloud: what you need, which models work, where chats are stored, and how sign-in works.",
  path: PATHS.faq,
});

export default function FaqPage(): ReactNode {
  return (
    <PageColumn>
      <JsonLd data={FAQ_JSON_LD} />
      <PageIntro title={PAGE_LABELS.faq} updated={FAQ_UPDATED} path={PATHS.faq} />
      <Accordion>
        {FAQ.map((item) => (
          <AccordionItem key={item.question} title={item.question} aside={item.isPrivacy ? <PrivacyTag /> : null}>
            {item.answer}
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-14">
        <h2 className="text-lg font-bold">{FAQ_MORE.title}</h2>
        <p className="text-muted-foreground mt-1.5 text-[17px] leading-relaxed">
          {FAQ_MORE.body} <TextLink href={SITE.issuesUrl}>{FAQ_MORE.linkLabel}</TextLink>
        </p>
      </div>
    </PageColumn>
  );
}
