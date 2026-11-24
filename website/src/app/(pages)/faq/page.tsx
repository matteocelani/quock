import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FaqList } from "@/components/faq/faq-list";
import { JsonLd } from "@/components/global/json-ld";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { FAQ_DESCRIPTION, FAQ_UPDATED } from "@/modules/faq/content";
import { FAQ_JSON_LD } from "@/modules/faq/schema";
import { pageMetadata } from "@/lib/metadata";
import { PAGE_LABELS, PATHS } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: PAGE_LABELS.faq,
  description: FAQ_DESCRIPTION,
  path: PATHS.faq,
});

export default function FaqPage(): ReactNode {
  return (
    <PageColumn>
      <JsonLd data={FAQ_JSON_LD} />
      <PageIntro title={PAGE_LABELS.faq} updated={FAQ_UPDATED} path={PATHS.faq} />
      <FaqList />
    </PageColumn>
  );
}
