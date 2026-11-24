import type { ReactNode } from "react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Heading } from "@/components/ui/heading";
import { RELEASE_LINES } from "@/modules/changelog/content";

const DATE_FORMAT = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Grouped by minor line with one row per patch; the newest patch starts open, the rest stay one tap away.
export function ReleaseLines(): ReactNode {
  return (
    <div className="space-y-20">
      {RELEASE_LINES.map(({ minor, summary, releases }, lineIndex) => (
        <section key={minor} aria-labelledby={`minor-${minor}`}>
          <Heading as="h2" size="subsection" id={`minor-${minor}`}>
            {minor}
          </Heading>
          {summary && <p className="text-body mt-3 leading-relaxed text-pretty">{summary}</p>}
          <Accordion className="mt-6">
            {releases.map((release, index) => (
              <AccordionItem
                key={release.version}
                title={release.version}
                open={lineIndex === 0 && index === 0}
                aside={
                  <time dateTime={release.date} className="text-faint-foreground shrink-0 text-ui font-bold">
                    {DATE_FORMAT.format(new Date(release.date))}
                  </time>
                }
              >
                <p className="text-foreground font-bold">{release.title}</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-faint-foreground">
                  {release.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
