import type { ReactNode } from "react";
import { Heading, Marker } from "@/components/ui/heading";
import { ButtonLink } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/icons";
import { DownloadButton } from "@/components/global/download-button";
import { HeroStage } from "@/components/home/hero/hero-stage";
import { HERO } from "@/modules/home/content";
import { SITE } from "@/lib/site";

interface FactProps {
  label: string;
  value: string;
}


// The quieter second CTA carries the price, so "free" is visible before the store opens.
function AppStoreButton(): ReactNode {
  return (
    <ButtonLink
      href={SITE.appStoreUrl}
      variant="secondary"
      className="hidden sm:inline-flex"
      aria-label={`App Store, ${SITE.priceLabel.toLowerCase()}`}
    >
      <DownloadIcon className="text-faint-foreground" />
      App Store
      <span className="bg-primary text-primary-foreground rounded-lg px-2 py-1 text-chip leading-none font-bold">
        {SITE.priceLabel}
      </span>
    </ButtonLink>
  );
}

// A faint label over a bold value: the two facts a visitor needs before tapping Download.
function Fact({ label, value }: FactProps): ReactNode {
  return (
    <div>
      <p className="text-faint-foreground text-ui leading-tight font-bold">{label}</p>
      <p className="text-muted-foreground text-lg leading-tight font-bold">{value}</p>
    </div>
  );
}

export function Hero(): ReactNode {
  return (
    <section className="pt-28 sm:pt-44">
      <div className="mx-auto max-w-hero px-5 sm:px-8">
        <Heading as="h1" size="display" className="enter enter-1">
          {HERO.headline[0]}
          <br />
          <Marker>{HERO.headline[1]}</Marker>
        </Heading>
        <div className="enter enter-2 mt-9 flex flex-wrap items-center gap-x-4 gap-y-6 sm:mt-11">
          <DownloadButton />
          <AppStoreButton />
          <div className="flex gap-7 sm:ml-4">
            {HERO.facts.map((fact) => (
              <Fact key={fact.value} {...fact} />
            ))}
          </div>
        </div>
      </div>
      <div className="enter enter-3 mt-14 sm:mt-16">
        <HeroStage />
      </div>
    </section>
  );
}
