import type { ReactNode } from "react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Heading } from "@/components/ui/heading";
import { ShieldIcon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { FAQ, FAQ_MORE } from "@/modules/faq/content";
import { SITE } from "@/lib/site";

// Marks the answers about data so a privacy-minded reader can scan for them; screen readers hear it too.
function PrivacyTag(): ReactNode {
  return (
    <span className="text-faint-foreground shrink-0">
      <ShieldIcon className="size-5" />
      <span className="sr-only">Privacy</span>
    </span>
  );
}

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
        <Heading as="h2" size="item">
          {FAQ_MORE.title}
        </Heading>
        <p className="text-muted-foreground text-body mt-1.5 leading-relaxed">
          {FAQ_MORE.body} <TextLink href={SITE.issuesUrl}>{FAQ_MORE.linkLabel}</TextLink>.
        </p>
      </div>
    </>
  );
}
