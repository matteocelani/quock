import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Lead } from "@/components/ui/heading";
import { ArrowIcon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { PrincipleList } from "@/components/privacy/principle-list";
import { PRIVACY_DESCRIPTION, PRIVACY_LEAD, PRIVACY_LINK, PRIVACY_NOTE, PRIVACY_UPDATED } from "@/modules/privacy/content";
import { pageMetadata } from "@/lib/metadata";
import { PAGE_LABELS, PATHS, SITE } from "@/lib/site";

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
      <p className="text-muted-foreground mt-10 text-ui leading-relaxed">
        {PRIVACY_NOTE} <TextLink href={SITE.ollamaPrivacyUrl}>{PRIVACY_LINK}</TextLink>.
      </p>
      <ButtonLink href={SITE.privacyUrl} variant="secondary" size="md" className="mt-8">
        Read the full policy
        <ArrowIcon />
      </ButtonLink>
    </PageColumn>
  );
}
