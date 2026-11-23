import type { CSSProperties, ReactNode } from "react";
import { Heading, Marker } from "@/components/ui/heading";
import { AppStoreButton, DownloadButton } from "@/components/global/download-button";
import { HeroStage } from "@/components/home/hero/hero-stage";

interface FactProps {
  label: string;
  value: string;
}

const step = (ms: number): CSSProperties => ({ "--delay": `${ms}ms` }) as CSSProperties;

// A faint label over a bold value: the two facts a visitor needs before tapping Download.
function Fact({ label, value }: FactProps): ReactNode {
  return (
    <div className="leading-tight">
      <p className="text-faint-foreground text-sm font-bold">{label}</p>
      <p className="text-muted-foreground text-lg font-bold">{value}</p>
    </div>
  );
}

export function Hero(): ReactNode {
  return (
    <section className="pt-28 sm:pt-44">
      <div className="mx-auto max-w-[62rem] px-5 sm:px-8">
        <Heading as="h1" size="display" className="enter" style={step(60)}>
          Open. Type.
          <br />
          <Marker>That&rsquo;s it.</Marker>
        </Heading>
        <div className="enter mt-9 flex flex-wrap items-center gap-x-4 gap-y-6 sm:mt-11" style={step(220)}>
          <DownloadButton />
          <AppStoreButton className="hidden sm:inline-flex" />
          <div className="flex gap-7 sm:ml-4">
            <Fact label="Every model on" value="Ollama Cloud" />
            <Fact label="Sign in with your" value="ollama.com account" />
          </div>
        </div>
      </div>
      <div className="enter mt-14 sm:mt-16" style={step(420)}>
        <HeroStage />
      </div>
    </section>
  );
}
