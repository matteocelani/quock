import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { THEME_COLOR } from "./src/lib/site";

// THEME_COLOR tints the browser chrome but cannot read CSS, so the build stops if it drifts from --background.
const css = readFileSync(path.join(__dirname, "src/app/globals.css"), "utf8");
const [light, dark] = [...css.matchAll(/--background:\s*(#[0-9a-f]{6});/gi)].map((match) => match[1].toLowerCase());
if (light !== THEME_COLOR.light || dark !== THEME_COLOR.dark) {
  throw new Error(`THEME_COLOR in src/lib/site.ts must match --background in globals.css (${light}, ${dark}).`);
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
