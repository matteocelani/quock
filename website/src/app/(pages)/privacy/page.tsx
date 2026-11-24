import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Lead } from "@/components/ui/heading";
import { ArrowIcon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { PrincipleList } from "@/components/privacy/principle-list";
import { PRIVACY_LEAD, PRIVACY_LINKS, PRIVACY_NOTE, PRIVACY_UPDATED } from "@/modules/privacy/content";
import { pageMetadata } from "@/lib/metadata";
import { PAGE_LABELS, PATHS, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: PAGE_LABELS.privacy,
  description:
    "How Quock handles your data: chats stored on your iPhone, messages sent straight to Ollama Cloud and signed with a per-device key, and no analytics.",
  path: PATHS.privacy,
});

export default function PrivacyPage(): ReactNode {
  return (
    <PageColumn>
      <PageIntro title={PAGE_LABELS.privacy} updated={PRIVACY_UPDATED} path={PATHS.privacy} />
      <Lead>{PRIVACY_LEAD}</Lead>
      <PrincipleList />
      <p className="text-muted-foreground mt-10 text-ui leading-relaxed">
        {PRIVACY_NOTE} <TextLink href={SITE.ollamaPrivacyUrl}>{PRIVACY_LINKS.ollama}</TextLink>.
      </p>
      <ButtonLink href={SITE.privacyUrl} variant="secondary" size="md" className="mt-8">
        {PRIVACY_LINKS.full}
        <ArrowIcon />
      </ButtonLink>
    </PageColumn>
  );
}
