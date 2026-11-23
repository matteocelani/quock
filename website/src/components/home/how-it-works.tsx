import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow, Heading } from "@/components/ui/heading";
import { ArrowIcon } from "@/components/ui/icons";
import { GUIDE_PATH, GUIDE_STEPS } from "@/modules/guide/content";

export function HowItWorks(): ReactNode {
  return (
    <section aria-labelledby="how-title" className="px-5 pt-32 sm:px-8 sm:pt-44">
      <div className="reveal mx-auto max-w-3xl text-center">
        <Eyebrow>How it works</Eyebrow>
        <Heading id="how-title" className="mt-2">
          Ready in three minutes.
        </Heading>
      </div>
      <ol className="mx-auto mt-14 grid max-w-[61rem] gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GUIDE_STEPS.map((step, index) => (
          <li key={step.title} className="reveal bg-panel rounded-tile p-6">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-[10px] text-base font-bold">
              {index + 1}
            </span>
            <h3 className="mt-5 text-lg leading-snug font-bold tracking-[-0.01em]">{step.title}</h3>
            <p className="text-muted-foreground mt-1.5 text-[15px] leading-relaxed text-pretty">{step.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 text-center">
        <Link
          href={GUIDE_PATH}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[17px] font-bold underline decoration-marker decoration-[0.35em] underline-offset-[-0.1em] [text-decoration-skip-ink:none] hover:decoration-accent/40"
        >
          The full guide to Ollama Cloud on iPhone
          <ArrowIcon className="size-4.5" />
        </Link>
      </div>
    </section>
  );
}
