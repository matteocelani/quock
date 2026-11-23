import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Lead } from "@/components/ui/heading";
import { ArrowIcon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { PRINCIPLES, PRIVACY_LEAD, PRIVACY_LINKS, PRIVACY_NOTE, PRIVACY_UPDATED } from "@/modules/privacy/content";
import { pageMetadata } from "@/lib/metadata";
import { PATHS, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description:
    "How Quock handles your data: chats stored on your iPhone, messages sent straight to Ollama Cloud and signed with a per-device key, and no analytics.",
  path: PATHS.privacy,
});

export default function PrivacyPage(): ReactNode {
  return (
    <PageColumn>
      <PageIntro title="Privacy" updated={PRIVACY_UPDATED} path={PATHS.privacy} />
      <Lead>{PRIVACY_LEAD}</Lead>
      <ul className="mt-10 divide-y">
        {PRINCIPLES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4 py-6">
            <Icon className="text-faint-foreground mt-0.5 size-6 shrink-0" />
            <div>
              <h2 className="text-lg font-bold tracking-[-0.01em] sm:text-2xl">{title}</h2>
              <p className="text-muted-foreground mt-1.5 text-[17px] leading-relaxed text-pretty">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-10 text-[15px] leading-relaxed">
        {PRIVACY_NOTE} <TextLink href={SITE.ollamaPrivacyUrl}>{PRIVACY_LINKS.ollama}</TextLink>
      </p>
      <ButtonLink href={SITE.privacyUrl} variant="secondary" size="md" className="mt-8">
        {PRIVACY_LINKS.full}
        <ArrowIcon />
      </ButtonLink>
    </PageColumn>
  );
}
