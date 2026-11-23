import path from "node:path";
import type { NextConfig } from "next";

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
