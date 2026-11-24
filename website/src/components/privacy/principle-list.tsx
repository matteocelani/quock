import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { ArrowIcon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { PRINCIPLES, PRIVACY_LINK, PRIVACY_NOTE } from "@/modules/privacy/content";
import { SITE } from "@/lib/site";

// Short claims with an icon each, so a reader can check the six promises at a glance.
export function PrincipleList(): ReactNode {
  return (
    <ul className="mt-10 divide-y">
      {PRINCIPLES.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-4 py-6">
          <Icon className="text-faint-foreground mt-0.5 size-6 shrink-0" />
          <div>
            <Heading as="h2" size="item">
              {title}
            </Heading>
            <p className="text-muted-foreground text-body mt-1.5 leading-relaxed text-pretty">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Where the full texts live: Ollama's own policy, then ours.
export function PolicyLinks(): ReactNode {
  return (
    <>
      <p className="text-muted-foreground mt-10 text-ui leading-relaxed">
        {PRIVACY_NOTE} <TextLink href={SITE.ollamaPrivacyUrl}>{PRIVACY_LINK}</TextLink>.
      </p>
      <ButtonLink href={SITE.privacyUrl} variant="secondary" size="md" className="mt-8">
        Read the full policy
        <ArrowIcon />
      </ButtonLink>
    </>
  );
}
