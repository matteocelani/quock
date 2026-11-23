import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { PRINCIPLES } from "@/modules/privacy/content";

// Short claims with an icon each, so a reader can check the six promises at a glance.
export function PrincipleList(): ReactNode {
  return (
    <ul className="mt-10 divide-y">
      {PRINCIPLES.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-4 py-6">
          <Icon className="text-faint-foreground mt-0.5 size-6 shrink-0" />
          <div>
            <Heading as="h2" size="item">
              {title}
            </Heading>
            <p className="text-muted-foreground text-body mt-1.5 leading-relaxed text-pretty">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
