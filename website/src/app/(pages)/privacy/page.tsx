import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Lead } from "@/components/ui/heading";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { PolicyLinks, PrincipleList } from "@/components/privacy/principle-list";
import { PRIVACY_DESCRIPTION, PRIVACY_LEAD, PRIVACY_UPDATED } from "@/modules/privacy/content";
import { pageMetadata } from "@/lib/metadata";
import { PAGE_LABELS, PATHS } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: PAGE_LABELS.privacy,
  description: PRIVACY_DESCRIPTION,
  path: PATHS.privacy,
});

export default function PrivacyPage(): ReactNode {
  return (
    <PageColumn>
      <PageIntro title={PAGE_LABELS.privacy} updated={PRIVACY_UPDATED} path={PATHS.privacy} />
      <Lead>{PRIVACY_LEAD}</Lead>
      <PrincipleList />
      <PolicyLinks />
    </PageColumn>
  );
}
