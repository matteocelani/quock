# AGENTS.md — Quock website

The marketing site for Quock: a small, static Next.js project beside the app. It shares nothing with the app at build time. The repo-wide rules (brand, licence, git workflow) still come from the root [`AGENTS.md`](../AGENTS.md).

**Before touching UI or copy, read [`.agent/design.md`](./.agent/design.md).** It is our design philosophy: why the site looks, reads and moves the way it does.

## Non-negotiables

1. **Small, modular, easy to maintain.** This is the rule every other rule serves. The site is built like the app: one job per file, one home per value, nothing "for later". If a change makes the site harder to update, it is the wrong change. Prefer deleting to adding.
2. **Brand neutrality, said positively.**
   - Describe Quock as an *independent, open-source* app **for** Ollama Cloud, never as "unofficial", and never as Ollama itself.
   - The legal line (`SITE.disclaimer`) appears only in the footer, the FAQ "Who makes Quock?" and `llms.txt`, always in small type.
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
src/app/                 Routes only: metadata plus composition, never data. (home) is light, (pages) is dark;
                         sitemap, robots, manifest, llms.txt, icons and OG sit beside them.
src/modules/<feature>/   Content and schema for one feature, with no UI:
                         faq, changelog, guide, privacy, home.
                         content.ts holds the copy, schema.ts the JSON-LD.
src/components/ui/       Primitives with no site knowledge: button, heading, accordion, screen-stack, icons.
src/components/layout/   Page frame: site-shell, site-header, site-footer, page-intro.
src/components/global/   App-wide pieces: logo, download buttons, json-ld.
src/components/home/     One file per home section. A section with parts gets a folder (bento/).
src/lib/                 Shared by 2+ features: site.ts (facts, URLs), screens.ts (captures, model names),
                         metadata.ts (page metadata, breadcrumbs, WebSite schema), utils.ts.
scripts/                 compose-assets.py: builds the committed images from docs/ and assets/.
```

Placement rules, the same as the app:
- **Who imports it decides where it lives.** Used by one file, it is a constant at the top of that file. Used by one feature, it goes in that feature's module or component folder. Used by two or more features, it goes in `lib/` (or `components/ui/` for a primitive). When something gets a second user, promote it in the same change.
- **Dependencies point one way:** `app → components → modules → lib`. `ui/` never imports `layout/`, `global/` or `home/`. Modules never import components, with one exception: they may reference `ui/icons` to tag their content.
- **One item is a file; two or more make a folder.** No empty folders, no stubs, no barrel `index.ts`.
- **Each value has one home.** Design tokens live in `globals.css` and are used through semantic classes (never a hex at the use site). Facts and URLs live in `site.ts`. Copy lives in its module, and one source feeds the page, the JSON-LD and `llms.txt`.
- **Files stay under about 300 lines.** Split only on a clean seam.

## Everyday updates

| Task | Touch only |
| --- | --- |
| New app release | `src/lib/site.ts` (version, date, size) and a new entry in `src/modules/changelog/content.ts` |
| New or changed question | `src/modules/faq/content.ts`. The page, the FAQPage JSON-LD and llms.txt follow on their own. |
| New screenshots | Replace `docs/screenshots/*.png`, then run `pnpm assets` |
| New home section | One file in `components/home/`, built from a pattern in `design.md`, added to `(home)/page.tsx` |
| New inner page | `modules/<slug>/content.ts` for the copy, a thin `app/(pages)/<slug>/page.tsx` with `pageMetadata()` and `PageIntro`, a row in `sitemap.ts` and a footer link |

## Commands (run inside `website/`)

| Command | Purpose |
| --- | --- |
| `pnpm install` / `pnpm dev` | Install, then run the dev server on :3000 |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | The gate (CI: `.github/workflows/website.yml`) |
| `pnpm assets` | Rebuild device shots, icons and the OG card (needs macOS for the SF Pro font) |

`pnpm build` writes static HTML to `out/`, which any host can serve. Set `NEXT_PUBLIC_SITE_URL` when deploying outside Vercel. Without a real URL, the build marks itself `noindex` on purpose.

## Code rules

- TypeScript strict, no `any`, explicit return types on exports, `@/*` imports, no barrel files.
- Server components by default. `"use client"` is allowed only for real interactivity: today that is `home/hero-stage.tsx` and `home/tabbed-showcase.tsx`, with local `useState` only. A server page passes icons to them as rendered elements.
- Every other animation is CSS, and `prefers-reduced-motion` turns it off.
- Metadata always goes through `pageMetadata()`, because Next merges `openGraph` shallowly. Structured data always goes through `<JsonLd>`.
- English in code and copy. Comments are 1–2 lines and say why.
