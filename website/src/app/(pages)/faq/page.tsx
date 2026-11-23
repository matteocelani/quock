import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { ShieldIcon } from "@/components/ui/icons";
import { JsonLd } from "@/components/global/json-ld";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { FAQ, FAQ_UPDATED } from "@/modules/faq/content";
import { FAQ_JSON_LD } from "@/modules/faq/schema";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "FAQs",
  description:
    "Answers about Quock, the independent iPhone app for Ollama Cloud: what you need, which models work, where chats are stored, and how sign-in works.",
  path: "/faq/",
});

export default function FaqPage(): ReactNode {
  return (
    <PageColumn>
      <JsonLd data={FAQ_JSON_LD} />
      <PageIntro title="FAQs" updated={FAQ_UPDATED} path="/faq/" />
      <Accordion>
        {FAQ.map((item) => (
          <AccordionItem
            key={item.question}
            title={item.question}
            aside={item.isPrivacy ? <ShieldIcon className="text-faint-foreground size-5 shrink-0" aria-label="Privacy" /> : null}
          >
            {item.answer}
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-14">
        <h2 className="text-lg font-bold">Have more questions?</h2>
        <p className="text-muted-foreground mt-1.5 text-[17px] leading-relaxed">
          Ask on{" "}
          <Link href={SITE.issuesUrl} target="_blank" rel="noopener noreferrer" className="text-foreground font-semibold underline decoration-accent decoration-2 underline-offset-4">
            GitHub
          </Link>
          , or read the{" "}
          <Link href="/privacy" className="text-foreground font-semibold underline decoration-accent decoration-2 underline-offset-4">
            privacy summary
          </Link>
          .
        </p>
      </div>
    </PageColumn>
  );
}
