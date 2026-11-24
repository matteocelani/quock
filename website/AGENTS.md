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
src/app/                 Routes compose: metadata, the page frame and components. They define no components and
                         own no content; a sentence of glue around a link is fine. (home) is light, (pages) is dark;
                         sitemap, robots, manifest, llms.txt and the icons sit beside them.
src/modules/<feature>/   Content and schema for one feature, with no UI:
                         faq, changelog, guide, privacy, home, llms, and site (site-wide copy: the 404, footer
                         notes, keywords; the WebSite and breadcrumb schema).
                         content.ts(x) holds the copy (.tsx only when it carries rendered elements),
                         schema.ts the JSON-LD; home/screens.ts the captures, model names and picked model.
                         The newest changelog entry is the live version: nothing else repeats it.
src/components/ui/       Primitives with no site knowledge: button, text-link, heading (Heading, Marker, Lead),
                         accordion, step-badge, icons.
src/components/layout/   Page frame: site-shell, site-header, site-footer, page-intro (PageIntro, and PageColumn,
                         the reading column: `max-w-reading`, 40rem, not Tailwind's 65ch `max-w-prose`).
src/components/global/   App-wide pieces: logo, download buttons, json-ld.
src/components/home/     One file per home section; a section with parts gets a folder (hero/, bento/).
                         Pieces only home uses live here too (screen-stack, roving-keys, typography).
src/components/<page>/   UI for one inner page, so its route stays thin: changelog/, guide/, privacy/, faq/.
src/lib/                 Shared by 2+ features: site.ts (facts, URLs, PATHS, PAGE_LABELS, LINK_LABELS, theme
                         colours, which the build checks against globals.css),
                         metadata.ts (title template, social metadata, the share card, author schema),
                         theme.ts (the @theme names cn() must know, checked by the build), utils.ts.
public/                  Committed images made by `pnpm assets`: screens/, app-icon.png, og.png (share card).
scripts/                 compose-assets.py: builds the committed images from docs/ and assets/.
```

Placement rules, the same as the app:
- **Who imports it decides where it lives.** Used by one file, it is a constant at the top of that file. Used by one feature, it goes in that feature's module or component folder. Used by two or more features, it goes in `lib/` (or `components/ui/` for a primitive). When something gets a second user, promote it in the same change.
  - Two exceptions. Content stays in the module that owns it, and other features read it from there: the home page shows the guide's steps, the version is the changelog's newest entry, and llms.txt reads every module. Every glyph lives in `ui/icons`, whoever uses it, so the set stays consistent.
- **Dependencies point one way:** `app → components → modules → lib`. `ui/` never imports `layout/`, `global/` or `home/`. Modules never import components, with one exception: they may reference `ui/icons` to tag their content.
- **Feature folders are always folders**, as in the app (`modules/<feature>/`, `components/<feature>/`), even with one file. Inside one, a single item is a file and two or more make a subfolder. No empty folders, no stubs, no barrel `index.ts`.
- **Each value has one home.**
  - Design tokens live in `globals.css` and are used through semantic classes. Never a hex at the use site.
  - Facts (version aside, which is the newest changelog entry), price, URLs, paths and page labels live in `site.ts`.
  - **Content lives in its module**: headlines, leads, tile and step copy, lists, the FAQ, anything a writer would edit. One source then feeds the page, the JSON-LD and llms.txt.
  - **Control labels stay in their component**: a button's text, an aria-label, a panel heading such as "Choose a model". They describe the control, not the product.
- **Files stay under about 300 lines.** Split only on a clean seam.

## Everyday updates

| Task | Touch only |
| --- | --- |
| New app release | A new entry at the top of `RELEASES` in `src/modules/changelog/content.ts`: it becomes the version everywhere and the changelog's "Updated" date, and a new minor line appears on its own (add a sentence to `LINE_SUMMARIES` if you want one). Update `sizeMb` in `src/lib/site.ts` if the store size changed. |
| New or changed question | `src/modules/faq/content.ts`. The page, the FAQPage JSON-LD and llms.txt follow on their own. |
| New screenshots | Replace `docs/screenshots/*.png` and run `pnpm assets`. Then check that `MODELS`, `PICKED_MODEL` and `SCREEN_ALT` in `src/modules/home/screens.ts` still describe what the captures show, and that `BLURRED_HEADER` and the avatar position in `scripts/compose-assets.py` still match them, so the avatar stays masked. |
| New home section | Its copy in `src/modules/home/content.tsx`, one file in `components/home/` built from a pattern in `design.md`, added to `(home)/page.tsx` |
| New inner page | Folders take the feature name; the URL can be a longer search phrase (the guide's folders are `guide/`, its route `/ollama-cloud-on-iphone/`). A path in `PATHS` and a label in `PAGE_LABELS` (llms.txt lists it on its own), `modules/<feature>/content.ts` for the copy, its UI in `components/<feature>/`, a thin `app/(pages)/<url-slug>/page.tsx` with `pageMetadata()` and `PageIntro`, a row in `sitemap.ts` and a footer link |

## Commands (run inside `website/`)

| Command | Purpose |
| --- | --- |
| `pnpm install` / `pnpm dev` | Install, then run the dev server on :3000 |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | The gate (CI: `.github/workflows/website.yml`) |
| `pnpm assets` | Rebuild device shots, icons and the share card `public/og.png`. Needs Python 3 with Pillow and, on macOS, Apple's SF Pro fonts in `/Library/Fonts` |

`pnpm build` writes static HTML to `out/`, which any host can serve. Set `NEXT_PUBLIC_SITE_URL` when deploying outside Vercel. Without a real URL, the build marks itself `noindex` on purpose.

## Code rules

- TypeScript strict, no `any`, explicit return types on exports, `@/*` imports, no barrel files.
- Server components by default. `"use client"` is allowed only for real interactivity: today that is `home/hero/hero-stage.tsx` and `home/tabbed-showcase.tsx`, with local `useState` only. Tabbed-showcase gets its tab icons from the module as rendered elements, because a server page cannot hand a component function to a client one.
- Every other animation is CSS, and `prefers-reduced-motion` turns it off.
- Inner pages set metadata through `pageMetadata()`, because Next merges `openGraph` shallowly. The root layout uses `socialMetadata()` directly, and the 404 sets `noindex` with no canonical and no social card. Structured data always goes through `<JsonLd>`.
- shadcn naming is kept for cva maps (`buttonVariants`, `headingVariants`), the one exception to UPPER_SNAKE_CASE constants.
- English in code and copy. Comments are 1–2 lines and say why.
