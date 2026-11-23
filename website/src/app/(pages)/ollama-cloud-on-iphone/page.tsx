import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { PhoneIcon } from "@/components/ui/icons";
import { JsonLd } from "@/components/global/json-ld";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { GUIDE_PATH, GUIDE_STEPS, GUIDE_TIPS, GUIDE_TITLE, GUIDE_UPDATED } from "@/modules/guide/content";
import { HOW_TO_JSON_LD } from "@/modules/guide/schema";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: GUIDE_TITLE,
  description:
    "Use Ollama Cloud models on your iPhone in four steps: get an ollama.com account, download Quock, sign in once, pick a model and type. Free, private, open source.",
  path: GUIDE_PATH,
});

const linkClass = "text-foreground font-semibold underline decoration-accent decoration-2 underline-offset-4";

export default function GuidePage(): ReactNode {
  return (
    <PageColumn>
      <JsonLd data={HOW_TO_JSON_LD} />
      <PageIntro title="Ollama Cloud on iPhone" updated={GUIDE_UPDATED} path={GUIDE_PATH} />
      <p className="text-[1.4375rem] leading-[1.35] font-bold tracking-[-0.01em] text-pretty">
        Ollama Cloud runs the best open models, from Gemma and Qwen to GPT-OSS, DeepSeek and Kimi, on
        Ollama&rsquo;s servers. Quock puts them on your iPhone in about three minutes.
      </p>

      <h2 className="sr-only">{GUIDE_TITLE}</h2>
      <ol className="mt-12 space-y-10">
        {GUIDE_STEPS.map((step, index) => (
          <li key={step.title} id={`step-${index + 1}`} className="flex gap-5 scroll-mt-28">
            <span className="bg-panel text-foreground flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold">
              {index + 1}
            </span>
            <div>
              <h3 className="text-lg font-bold tracking-[-0.01em] sm:text-2xl">{step.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-[17px] leading-relaxed text-pretty">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <ButtonLink href={SITE.appStoreUrl} className="mt-12">
        <PhoneIcon />
        Download for iPhone
      </ButtonLink>

      <Heading as="h2" size="card" className="mt-24 text-3xl sm:text-4xl">
        Make the most of it
      </Heading>
      <ul className="mt-6 divide-y">
        {GUIDE_TIPS.map((tip) => (
          <li key={tip.title} className="py-5">
            <h3 className="text-lg font-bold tracking-[-0.01em]">{tip.title}</h3>
            <p className="text-muted-foreground mt-1 text-[17px] leading-relaxed text-pretty">{tip.body}</p>
          </li>
        ))}
      </ul>

      <Heading as="h2" size="card" className="mt-24 text-3xl sm:text-4xl">
        Where your chats live
      </Heading>
      <p className="text-muted-foreground mt-4 text-[17px] leading-relaxed text-pretty">
        On your iPhone, in a local database. There is no Quock server and no analytics. When you send a
        message, it goes straight to Ollama Cloud with the earlier turns of that chat. Read the{" "}
        <Link href="/privacy" className={linkClass}>
          privacy summary
        </Link>{" "}
        or browse the{" "}
        <Link href="/faq" className={linkClass}>
          FAQs
        </Link>
        .
      </p>
    </PageColumn>
  );
}
