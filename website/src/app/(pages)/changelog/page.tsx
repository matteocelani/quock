import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Heading } from "@/components/ui/heading";
import { TextLink } from "@/components/ui/text-link";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { CHANGELOG_FOOTNOTE, CHANGELOG_UPDATED, LATEST_RELEASE, RELEASE_LINES } from "@/modules/changelog/content";
import { pageMetadata } from "@/lib/metadata";
import { PAGE_LABELS, PATHS, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: PAGE_LABELS.changelog,
  description: `What changed in each Quock release, up to version ${LATEST_RELEASE.version}.`,
  path: PATHS.changelog,
});

const DATE_FORMAT = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function ChangelogPage(): ReactNode {
  return (
    <PageColumn>
      <PageIntro title={PAGE_LABELS.changelog} updated={CHANGELOG_UPDATED} path={PATHS.changelog} />
      <div className="space-y-20">
        {RELEASE_LINES.map(({ releases, ...line }, lineIndex) => {
          return (
            <section key={line.minor} aria-labelledby={`minor-${line.minor}`}>
              <Heading as="h2" size="card" id={`minor-${line.minor}`} className="text-3xl sm:text-4xl">
                {line.minor}
              </Heading>
              <p className="mt-3 text-[17px] leading-relaxed text-pretty">{line.summary}</p>
              <Accordion className="mt-6">
                {releases.map((release, index) => (
                  <AccordionItem
                    key={release.version}
                    title={release.version}
                    open={lineIndex === 0 && index === 0}
                    aside={
                      <time dateTime={release.date} className="text-faint-foreground shrink-0 text-sm font-bold">
                        {DATE_FORMAT.format(new Date(release.date))}
                      </time>
                    }
                  >
                    <p className="text-foreground font-bold">{release.title}</p>
                    <ul className="mt-3 space-y-2">
                      {release.changes.map((change) => (
                        <li key={change} className="flex gap-3">
                          <span aria-hidden="true" className="bg-faint-foreground mt-2.5 size-1.5 shrink-0 rounded-full" />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          );
        })}
      </div>
      <p className="text-muted-foreground mt-16 text-[17px]">
        {CHANGELOG_FOOTNOTE.body} <TextLink href={SITE.releasesUrl}>{CHANGELOG_FOOTNOTE.linkLabel}</TextLink>.
      </p>
    </PageColumn>
  );
}
