import type { ComponentType, ReactNode, SVGProps } from "react";
import { Heading } from "@/components/ui/heading";
import {
  CodeIcon,
  DocumentIcon,
  GlobeIcon,
  ModelsIcon,
  MoonIcon,
  PinIcon,
  StreamIcon,
  ThinkIcon,
} from "@/components/ui/icons";

interface Feature {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: [string, string];
}

// A recap the eye takes in at once, just before the last call to download.
const FEATURES: readonly Feature[] = [
  { icon: StreamIcon, title: ["Streamed", "replies"] },
  { icon: ModelsIcon, title: ["Every cloud", "model"] },
  { icon: ThinkIcon, title: ["Thinking", "on demand"] },
  { icon: GlobeIcon, title: ["Live web", "search"] },
  { icon: DocumentIcon, title: ["On-device", "PDF reading"] },
  { icon: PinIcon, title: ["Pinned chats", "and forks"] },
  { icon: MoonIcon, title: ["Light and", "dark themes"] },
  { icon: CodeIcon, title: ["Free and", "open source"] },
];

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
