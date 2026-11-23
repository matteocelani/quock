import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { FEATURES } from "@/modules/home/content";

// A recap the eye takes in at once, just before the last call to download.
export function FeatureGrid(): ReactNode {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-28 px-5 pt-32 sm:px-8 sm:pt-44">
      <h2 id="features-title" className="sr-only">
        Features
      </h2>
      <ul className="mx-auto grid max-w-[61rem] grid-cols-2 gap-x-4 gap-y-14 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title }) => (
          <li key={title.join(" ")} className="reveal flex flex-col items-center text-center">
            <Icon className="size-14 sm:size-16" strokeWidth={1.4} />
            <Heading as="h3" size="feature" className="mt-5">
              {title[0]}
              <br />
              {title[1]}
            </Heading>
          </li>
        ))}
      </ul>
    </section>
  );
}
