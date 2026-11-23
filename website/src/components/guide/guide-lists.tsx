import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { StepBadge } from "@/components/ui/step-badge";
import { GUIDE_STEPS, GUIDE_TIPS, stepAnchor } from "@/modules/guide/content";

// Each step is an anchor target, because the HowTo JSON-LD links search results straight to it.
export function GuideSteps(): ReactNode {
  return (
    <ol className="mt-12 space-y-10">
      {GUIDE_STEPS.map((step, index) => (
        <li key={step.title} id={stepAnchor(index)} className="flex scroll-mt-28 gap-5">
          <StepBadge step={index + 1} />
          <div>
            <Heading as="h3" size="item">
              {step.title}
            </Heading>
            <p className="text-muted-foreground text-body mt-1.5 leading-relaxed text-pretty">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function GuideTips(): ReactNode {
  return (
    <ul className="mt-6 divide-y">
      {GUIDE_TIPS.map((tip) => (
        <li key={tip.title} className="py-5">
          <h3 className="tracking-title text-lg font-bold">{tip.title}</h3>
          <p className="text-muted-foreground text-body mt-1 leading-relaxed text-pretty">{tip.body}</p>
        </li>
      ))}
    </ul>
  );
}
