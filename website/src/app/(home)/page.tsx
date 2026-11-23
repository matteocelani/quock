import type { ReactNode } from "react";
import { Caption } from "@/components/ui/heading";
import { ThinkIcon } from "@/components/ui/icons";
import { Bento } from "@/components/home/bento/bento";
import { FeatureGrid } from "@/components/home/feature-grid";
import { FinalCta } from "@/components/home/final-cta";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { TabbedShowcase } from "@/components/home/tabbed-showcase";
import { JsonLd } from "@/components/global/json-ld";
import { APP_JSON_LD } from "@/modules/home/schema";
import { DUSK, MODEL_TABS, THINKING_TABS } from "@/modules/home/showcases";

export default function HomePage(): ReactNode {
  return (
    <>
      <JsonLd data={APP_JSON_LD} />
      <Hero />
      <TabbedShowcase
        id="models"
        eyebrow="Open models"
        title="Every model. One tap."
        lead="Pick any model on Ollama Cloud and start typing. Quock signs you in with your ollama.com account and gets out of the way."
        tabs={MODEL_TABS}
      />
      <TabbedShowcase
        id="thinking"
        eyebrow="Reasoning"
        title={
          <>
            Watch it <span className="thinking-text">think.</span>
          </>
        }
        lead="Turn on thinking for any model that supports it, and follow the reasoning as it streams, right above the answer."
        tabs={THINKING_TABS}
        wallpaper={DUSK}
        footnote={
          <Caption>
            <ThinkIcon className="size-3.5" />
            Thinking needs a thinking-capable model
          </Caption>
        }
      />
      <Bento />
      <HowItWorks />
      <FeatureGrid />
      <FinalCta />
    </>
  );
}
