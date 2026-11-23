import type { ReactNode } from "react";
import { Bento } from "@/components/home/bento/bento";
import { FeatureGrid } from "@/components/home/feature-grid";
import { FinalCta } from "@/components/home/final-cta";
import { Hero } from "@/components/home/hero/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { TabbedShowcase } from "@/components/home/tabbed-showcase";
import { JsonLd } from "@/components/global/json-ld";
import { SHOWCASES } from "@/modules/home/content";
import { APP_JSON_LD } from "@/modules/home/schema";

export default function HomePage(): ReactNode {
  return (
    <>
      <JsonLd data={APP_JSON_LD} />
      <Hero />
      {SHOWCASES.map((showcase) => (
        <TabbedShowcase key={showcase.id} {...showcase} />
      ))}
      <Bento />
      <HowItWorks />
      <FeatureGrid />
      <FinalCta />
    </>
  );
}
