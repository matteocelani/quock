import type { MetadataRoute } from "next";
import { PATHS, SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-static";

const ROUTES = [
  { path: PATHS.home, priority: 1, changeFrequency: "weekly" },
  { path: PATHS.guide, priority: 0.9, changeFrequency: "monthly" },
  { path: PATHS.faq, priority: 0.8, changeFrequency: "monthly" },
  { path: PATHS.changelog, priority: 0.6, changeFrequency: "weekly" },
  { path: PATHS.privacy, priority: 0.5, changeFrequency: "yearly" },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SITE.versionDate);
  return ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
