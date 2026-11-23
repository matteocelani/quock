import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { DownloadIcon, GithubIcon, ShieldIcon, XIcon } from "@/components/ui/icons";
import { PAGE_LABELS, PATHS, SITE } from "@/lib/site";
import { externalLinkProps } from "@/lib/utils";

interface IconLink {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const ICON_LINKS: readonly IconLink[] = [
  { href: SITE.githubUrl, label: "Quock on GitHub", icon: GithubIcon },
  { href: SITE.authorXUrl, label: `${SITE.author} on X`, icon: XIcon },
  { href: SITE.appStoreUrl, label: "Quock on the App Store", icon: DownloadIcon },
  { href: PATHS.privacy, label: PAGE_LABELS.privacy, icon: ShieldIcon },
];

const TEXT_LINKS = [
  { href: PATHS.guide, label: PAGE_LABELS.guide },
  { href: PATHS.faq, label: PAGE_LABELS.faq },
  { href: PATHS.changelog, label: PAGE_LABELS.changelog },
  { href: PATHS.privacy, label: PAGE_LABELS.privacy },
  { href: SITE.termsUrl, label: "Terms" },
  { href: SITE.githubUrl, label: "Source" },
] as const;

// The footer whispers: the legal line lives here in small type, so headlines never have to carry it.
export function SiteFooter(): ReactNode {
  return (
    <footer className="relative mt-24 overflow-hidden pt-10 sm:mt-28">
      <div className="relative z-10 flex flex-col items-center gap-6 px-5 text-center">
        <ul className="flex gap-2.5">
          {ICON_LINKS.map(({ href, label, icon: Icon }) => (
            <li key={label}>
              <Link
                href={href}
                aria-label={label}
                className="bg-panel text-faint-foreground hover:text-foreground flex size-9 items-center justify-center rounded-xl transition-colors"
                {...externalLinkProps(href)}
              >
                <Icon className="size-4.5" />
              </Link>
            </li>
          ))}
        </ul>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {TEXT_LINKS.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className="text-faint-foreground hover:text-foreground text-sm font-bold transition-colors"
              {...externalLinkProps(href)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-faint-foreground max-w-xl text-xs leading-relaxed font-medium">
          {SITE.disclaimer} Ollama is a trademark of its respective owner. App Store and iPhone are
          trademarks of Apple Inc. © 2026 {SITE.author}.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none relative mt-10 flex justify-center select-none [mask-image:linear-gradient(to_bottom,black_35%,transparent_100%)]"
      >
        <span className="text-foreground/[0.07] translate-y-[12%] text-[clamp(7rem,30vw,26rem)] leading-[0.82] font-bold tracking-[-0.06em]">
          {SITE.name}
        </span>
      </div>
    </footer>
  );
}
