import type { ReactNode } from "react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { TextLink } from "@/components/ui/text-link";
import { PrivacyTag } from "@/components/faq/privacy-tag";
import { FAQ, FAQ_MORE } from "@/modules/faq/content";
import { SITE } from "@/lib/site";

// Every answer stays in the HTML even when folded, so readers can find-in-page and crawlers read it all.
export function FaqList(): ReactNode {
  return (
    <>
      <Accordion>
        {FAQ.map((item) => (
          <AccordionItem key={item.question} title={item.question} aside={item.isPrivacy ? <PrivacyTag /> : null}>
            {item.answer}
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-14">
        <h2 className="text-lg font-bold">{FAQ_MORE.title}</h2>
        <p className="text-muted-foreground text-body mt-1.5 leading-relaxed">
          {FAQ_MORE.body} <TextLink href={SITE.issuesUrl}>{FAQ_MORE.linkLabel}</TextLink>.
        </p>
      </div>
    </>
  );
}
