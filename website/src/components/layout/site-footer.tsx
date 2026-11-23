import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { DownloadIcon, GithubIcon, ShieldIcon, XIcon } from "@/components/ui/icons";
import { SITE } from "@/lib/site";

interface IconLink {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const ICON_LINKS: readonly IconLink[] = [
  { href: SITE.githubUrl, label: "Quock on GitHub", icon: GithubIcon },
  { href: SITE.authorXUrl, label: `${SITE.author} on X`, icon: XIcon },
  { href: SITE.appStoreUrl, label: "Quock on the App Store", icon: DownloadIcon },
  { href: "/privacy", label: "Privacy", icon: ShieldIcon },
];

const TEXT_LINKS = [
  { href: "/ollama-cloud-on-iphone", label: "Guide" },
  { href: "/faq", label: "FAQs" },
  { href: "/changelog", label: "Changelog" },
  { href: "/privacy", label: "Privacy" },
  { href: SITE.termsUrl, label: "Terms" },
  { href: SITE.githubUrl, label: "Source" },
] as const;

const externalProps = (href: string): Record<string, string> =>
  href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {};

// Small square icon links and a giant fading wordmark as the sign-off.
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
                className="bg-panel text-faint-foreground hover:text-foreground flex size-9 items-center justify-center rounded-[10px] transition-colors"
                {...externalProps(href)}
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
              {...externalProps(href)}
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
          Quock
        </span>
      </div>
    </footer>
  );
}
