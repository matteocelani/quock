"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Eyebrow, Heading, Lead } from "@/components/ui/heading";
import { ScreenStack } from "@/components/ui/screen-stack";
import type { ShowcaseTab } from "@/modules/home/showcases";
import { cn } from "@/lib/utils";

interface TabbedShowcaseProps {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead: string;
  tabs: readonly ShowcaseTab[];
  wallpaper?: CSSProperties;
  footnote?: ReactNode;
}

const TAB_DURATION_MS = 6000;

// Showcase pattern: the tabs advance on their own, and each bar fills while its tab plays.
// The fill is a CSS animation; when it ends the next tab starts, so reduced motion means no autoplay.
export function TabbedShowcase({ id, eyebrow, title, lead, tabs, wallpaper, footnote }: TabbedShowcaseProps): ReactNode {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const screens = [...new Set(tabs.map((tab) => tab.screen))];

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 px-5 pt-32 sm:px-8 sm:pt-44">
      <div className="reveal mx-auto max-w-3xl text-center">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading id={`${id}-title`} className="mt-2">
          {title}
        </Heading>
        <Lead className="mx-auto mt-6 max-w-2xl">{lead}</Lead>
      </div>

      <div
        className="reveal relative isolate mx-auto mt-14 h-[28rem] max-w-[61rem] overflow-hidden rounded-[2rem] sm:h-[34rem]"
        style={wallpaper}
      >
        <div aria-hidden="true" className="wallpaper -z-10" />
        <div className="absolute inset-x-0 top-8 flex justify-center sm:top-12">
          <ScreenStack
            screens={screens}
            active={tabs[active].screen}
            className="w-60 sm:w-[18.5rem]"
            sizes="(min-width: 640px) 296px, 240px"
          />
        </div>
      </div>
      {footnote && <div className="mt-4 flex justify-center">{footnote}</div>}

      <div
        role="tablist"
        aria-label={eyebrow}
        className="mx-auto mt-8 grid max-w-[61rem] gap-6 sm:grid-cols-3 sm:gap-8"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {tabs.map((tab, index) => {
          const isActive = index === active;
          return (
            <button
              key={tab.lead}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(index)}
              className="group text-left"
            >
              <span
                className={cn(
                  "block transition-opacity [&_svg]:size-7",
                  isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70",
                )}
              >
                {tab.icon}
              </span>
              <p className="mt-3 text-[15px] leading-snug text-pretty">
                <span className="font-bold">{tab.lead}</span>{" "}
                <span className="text-muted-foreground">{tab.body}</span>
              </p>
              <span className="bg-panel-strong mt-4 block h-0.5 overflow-hidden rounded-full">
                {isActive && (
                  <span
                    key={active}
                    className="progress-run bg-foreground block h-full rounded-full"
                    style={
                      {
                        "--duration": `${TAB_DURATION_MS}ms`,
                        animationPlayState: isPaused ? "paused" : "running",
                      } as CSSProperties
                    }
                    onAnimationEnd={() => setActive((current) => (current + 1) % tabs.length)}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
