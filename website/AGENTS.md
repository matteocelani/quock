# AGENTS.md — Quock website

The marketing site for Quock: a small, static Next.js project beside the app. It shares nothing with the app at build time. The repo-wide rules (brand, licence, git workflow) still come from the root [`AGENTS.md`](../AGENTS.md).

**Before touching UI or copy, read [`.agent/design.md`](./.agent/design.md).** It is our design philosophy: why the site looks, reads and moves the way it does.

## Non-negotiables

1. **Small, modular, easy to maintain.** This is the rule every other rule serves. The site is built like the app: one job per file, one home per value, nothing "for later". If a change makes the site harder to update, it is the wrong change. Prefer deleting to adding.
2. **Brand neutrality, said positively.**
   - Describe Quock as an *independent, open-source* app **for** Ollama Cloud, never as "unofficial", and never as Ollama itself.
   - The legal line (`SITE.disclaimer`) appears in exactly three places: the footer (small type), the FAQ answer "Who makes Quock?" and `llms.txt`. Never in a headline, the hero or a `<title>`.
   - The Ollama logo and mascot never appear. Captures go through `scripts/compose-assets.py`, which masks the ollama.com avatar.
3. **No tracking, no weight.** There are no analytics, cookies, third-party scripts or webfonts. Type is the system font.
4. **Facts come from a source.**
   - Version, price, minimum iOS and size: the App Store lookup API.
   - Features: the release branches.
   - Privacy claims: `docs/PRIVACY.md`.
5. **Own atoms.** We follow shadcn conventions (`components.json`, `cn()`, `cva`, semantic CSS variables) but write every primitive ourselves. Icons are inline SVG. A new npm package needs the maintainer's approval.
6. **Never name design inspirations.** No external site, product or maker we took ideas from goes in code, docs, commits or PRs. Describe the design on its own terms.

## Structure

Same shape as the app: features in `modules/`, their UI in `components/`, shared pieces in `lib/`, and thin routes in `app/`.

```
src/app/                 Routes only: metadata plus composition. (home) is light, (pages) is dark;
                         sitemap, robots, manifest, llms.txt and the icons sit beside them.
src/modules/<feature>/   Content and schema for one feature, with no UI:
                         faq, changelog, guide, privacy, home, llms.
                         content.ts(x) holds the copy (.tsx only when it carries rendered elements),
                         schema.ts the JSON-LD; home/screens.ts the captures and model names.
                         The newest changelog entry is the live version: nothing else repeats it.
src/components/ui/       Primitives with no site knowledge: button, text-link, heading (Heading, Marker, Lead),
                         accordion, icons.
src/components/layout/   Page frame: site-shell, site-header, site-footer, page-intro.
src/components/global/   App-wide pieces: logo, download buttons, json-ld.
src/components/home/     One file per home section; a section with parts gets a folder (hero/, bento/).
                         Pieces only home uses live here too (screen-stack, tab-keys, typography).
src/components/faq/      Pieces only the FAQ page uses (privacy-tag).
src/lib/                 Shared by 2+ features: site.ts (facts, URLs, PATHS, PAGE_LABELS, theme colours),
                         metadata.ts (title template, social metadata, share image, breadcrumbs, WebSite
                         schema), utils.ts.
public/                  Committed images made by `pnpm assets`: screens/, app-icon.png, og.png (share card).
scripts/                 compose-assets.py: builds the committed images from docs/ and assets/.
```

Placement rules, the same as the app:
- **Who imports it decides where it lives.** Used by one file, it is a constant at the top of that file. Used by one feature, it goes in that feature's module or component folder. Used by two or more features, it goes in `lib/` (or `components/ui/` for a primitive). When something gets a second user, promote it in the same change.
- **Dependencies point one way:** `app → components → modules → lib`. `ui/` never imports `layout/`, `global/` or `home/`. Modules never import components, with one exception: they may reference `ui/icons` to tag their content.
- **One item is a file; two or more make a folder.** No empty folders, no stubs, no barrel `index.ts`.
- **Each value has one home.**
  - Design tokens live in `globals.css` and are used through semantic classes. Never a hex at the use site.
  - Facts, URLs, paths and page labels live in `site.ts`.
  - Copy that feeds more than one surface (a page and its JSON-LD, llms.txt, another page) lives in its module.
  - Copy that only one component shows is a constant at the top of that file, the same placement rule as everything else.
- **Files stay under about 300 lines.** Split only on a clean seam.

## Everyday updates

| Task | Touch only |
| --- | --- |
| New app release | A new entry at the top of `src/modules/changelog/content.ts`: it becomes the version everywhere and the changelog's "Updated" date. Update `sizeMb` in `src/lib/site.ts` if the store size changed. |
| New or changed question | `src/modules/faq/content.ts`. The page, the FAQPage JSON-LD and llms.txt follow on their own. |
| New screenshots | Replace `docs/screenshots/*.png`, then run `pnpm assets` |
| New home section | One file in `components/home/`, built from a pattern in `design.md`, added to `(home)/page.tsx` |
| New inner page | A path in `PATHS` and a label in `PAGE_LABELS` (llms.txt lists it on its own), `modules/<slug>/content.ts` for the copy, a thin `app/(pages)/<slug>/page.tsx` with `pageMetadata()` and `PageIntro`, a row in `sitemap.ts` and a footer link |

## Commands (run inside `website/`)

| Command | Purpose |
| --- | --- |
| `pnpm install` / `pnpm dev` | Install, then run the dev server on :3000 |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | The gate (CI: `.github/workflows/website.yml`) |
| `pnpm assets` | Rebuild device shots, icons and the share card `public/og.png`. Needs Python 3 with Pillow and, on macOS, Apple's SF Pro fonts in `/Library/Fonts` |

`pnpm build` writes static HTML to `out/`, which any host can serve. Set `NEXT_PUBLIC_SITE_URL` when deploying outside Vercel. Without a real URL, the build marks itself `noindex` on purpose.

## Code rules

- TypeScript strict, no `any`, explicit return types on exports, `@/*` imports, no barrel files.
- Server components by default. `"use client"` is allowed only for real interactivity: today that is `home/hero/hero-stage.tsx` and `home/tabbed-showcase.tsx`, with local `useState` only. A server page passes icons to them as rendered elements.
- Every other animation is CSS, and `prefers-reduced-motion` turns it off.
- Inner pages set metadata through `pageMetadata()`, because Next merges `openGraph` shallowly. The root layout uses `socialMetadata()` directly, and the 404 sets `noindex` with no canonical and no social card. Structured data always goes through `<JsonLd>`.
- shadcn naming is kept for cva maps (`buttonVariants`, `headingVariants`), the one exception to UPPER_SNAKE_CASE constants.
- English in code and copy. Comments are 1–2 lines and say why.
