import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { NotesIcon } from "@/components/ui/icons";
import { JsonLd } from "@/components/global/json-ld";
import { breadcrumbJsonLd } from "@/lib/metadata";

interface PageIntroProps {
  title: string;
  updated: string;
  path: string;
}

interface PageColumnProps {
  children: ReactNode;
}

const MONTH = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" });

// Every reading page opens the same way, and carries its breadcrumb so search shows Home > Page.
export function PageIntro({ title, updated, path }: PageIntroProps): ReactNode {
  return (
    <div className="pt-32 pb-10 sm:pt-44 sm:pb-12">
      <JsonLd data={breadcrumbJsonLd(title, path)} />
      <Heading as="h1" size="display" className="enter">
        {title}
      </Heading>
      <p className="text-faint-foreground enter mt-3 flex items-center gap-1.5 text-sm font-bold" style={{ animationDelay: "120ms" }}>
        <NotesIcon className="size-4" />
        Updated <time dateTime={updated}>{MONTH.format(new Date(updated))}</time>
      </p>
    </div>
  );
}

// One narrow column keeps reading pages at a comfortable line length.
export function PageColumn({ children }: PageColumnProps): ReactNode {
  return <div className="mx-auto max-w-[40rem] px-5 sm:px-0">{children}</div>;
}
