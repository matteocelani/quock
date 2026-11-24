import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { ArrowIcon } from "@/components/ui/icons";
import { StepBadge } from "@/components/ui/step-badge";
import { TextLink } from "@/components/ui/text-link";
import { Eyebrow } from "@/components/home/typography";
import { GUIDE_STEPS, GUIDE_TITLE } from "@/modules/guide/content";
import { HOW_IT_WORKS } from "@/modules/home/content";
import { PATHS } from "@/lib/site";

// The steps are the guide's own, so the short version here and the full page never disagree.
export function HowItWorks(): ReactNode {
  return (
    <section aria-labelledby="how-title" className="px-5 pt-32 sm:px-8 sm:pt-44">
      <div className="reveal mx-auto max-w-3xl text-center">
        <Eyebrow>{HOW_IT_WORKS.eyebrow}</Eyebrow>
        <Heading id="how-title" className="mt-2">
          {HOW_IT_WORKS.title}
        </Heading>
      </div>
      <ol className="mx-auto mt-14 grid max-w-content gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GUIDE_STEPS.map((step, index) => (
          <li key={step.title} className="reveal bg-panel rounded-tile p-6">
            <StepBadge step={index + 1} />
            <h3 className="mt-5 text-lg leading-snug font-bold tracking-title">{step.title}</h3>
            <p className="text-muted-foreground mt-1.5 text-ui leading-relaxed text-pretty">{step.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-center">
        <TextLink href={PATHS.guide} className="inline-flex items-center gap-1.5 text-body">
          {GUIDE_TITLE}
          <ArrowIcon className="size-4.5" />
        </TextLink>
      </p>
    </section>
  );
}
