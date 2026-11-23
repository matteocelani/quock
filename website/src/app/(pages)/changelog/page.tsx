import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Heading } from "@/components/ui/heading";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { CHANGELOG_UPDATED, MINOR_LINES, RELEASES } from "@/modules/changelog/content";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Changelog",
  description: `What changed in each Quock release, up to version ${SITE.version}.`,
  path: "/changelog/",
});

const DATE_FORMAT = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function ChangelogPage(): ReactNode {
  return (
    <PageColumn>
      <PageIntro title="Changelog" updated={CHANGELOG_UPDATED} path="/changelog/" />
      <div className="space-y-20">
        {MINOR_LINES.map((line) => {
          const releases = RELEASES.filter((release) => release.version.startsWith(`${line.minor}.`));
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
                    open={line === MINOR_LINES[0] && index === 0}
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
        Pull requests and commits behind each tagged release are on{" "}
        <Link
          href={`${SITE.githubUrl}/releases`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground font-semibold underline decoration-accent decoration-2 underline-offset-4"
        >
          GitHub
        </Link>
        .
      </p>
    </PageColumn>
  );
}
