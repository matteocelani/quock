import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ArrowIcon } from "@/components/ui/icons";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { PRINCIPLES, PRIVACY_UPDATED } from "@/modules/privacy/content";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description:
    "How Quock handles your data: no Quock server, chats stored on your iPhone, no analytics. Messages go straight to Ollama Cloud, signed with a per-device key.",
  path: "/privacy/",
});

export default function PrivacyPage(): ReactNode {
  return (
    <PageColumn>
      <PageIntro title="Privacy" updated={PRIVACY_UPDATED} path="/privacy/" />
      <p className="text-[1.4375rem] leading-[1.35] font-bold tracking-[-0.01em] text-pretty">
        Quock was built so there is almost nothing to protect: no account of ours, no server of ours, nothing to sell.
      </p>
      <ul className="mt-10 divide-y">
        {PRINCIPLES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4 py-6">
            <Icon className="text-faint-foreground mt-0.5 size-6 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold tracking-[-0.01em] sm:text-2xl">{title}</h2>
              <p className="text-muted-foreground mt-1.5 text-[17px] leading-relaxed text-pretty">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="text-muted-foreground mt-10 space-y-4 text-[15px] leading-relaxed">
        <p>
          This page is a summary. The full privacy policy is the controlling text, covering legal bases,
          retention and your rights under GDPR and similar laws. For what happens on Ollama&rsquo;s side, read{" "}
          <Link
            href="https://ollama.com/privacy"
            className="text-foreground font-semibold underline decoration-accent decoration-2 underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ollama&rsquo;s privacy policy
          </Link>
          .
        </p>
        <p>{SITE.disclaimer}</p>
      </div>
      <ButtonLink href={SITE.privacyUrl} variant="secondary" size="md" className="mt-8">
        Read the full policy
        <ArrowIcon />
      </ButtonLink>
    </PageColumn>
  );
}
