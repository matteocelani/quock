import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { THEME_COLOR } from "./src/lib/site";
import { THEME_TOKENS } from "./src/lib/theme";

// THEME_COLOR tints the browser chrome but cannot read CSS, so the build stops if it drifts from --background.
const css = readFileSync(path.join(__dirname, "src/app/globals.css"), "utf8");
const [light, dark] = [...css.matchAll(/--background:\s*(#[0-9a-f]{6});/gi)].map((match) => match[1].toLowerCase());
if (light !== THEME_COLOR.light || dark !== THEME_COLOR.dark) {
  throw new Error(`THEME_COLOR in src/lib/site.ts must match --background in globals.css (${light}, ${dark}).`);
}

// cn() drops classes it cannot group, so every custom @theme name must be in THEME_TOKENS (src/lib/theme.ts).
const themeBlock = css.slice(css.indexOf("@theme inline"), css.indexOf("\n}", css.indexOf("@theme inline")));
const groups = Object.keys(THEME_TOKENS).join("|");
const declared = [...themeBlock.matchAll(new RegExp(`--(${groups})-([a-z0-9-]+?):`, "g"))].map((m) => `${m[1]}-${m[2]}`);
const listed = Object.entries(THEME_TOKENS).flatMap(([group, names]) => names.map((name) => `${group}-${name}`));
const drift = [...declared.filter((t) => !listed.includes(t)), ...listed.filter((t) => !declared.includes(t))];
if (drift.length > 0) {
  throw new Error(`THEME_TOKENS in src/lib/theme.ts and @theme in globals.css disagree: ${drift.join(", ")}.`);
}

// Static export: the site is plain HTML, so it deploys to any host (Vercel, Pages, a bucket).
const nextConfig: NextConfig = {
  output: "export",
  // Emits faq/index.html, which every static host (buckets included) serves at /faq/.
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // website/AGENTS.md is hand-written; stop `next dev` from appending its own rules block to it.
  agentRules: false,
  // The app's lockfile one level up would otherwise make Turbopack treat the whole repo as the root.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
