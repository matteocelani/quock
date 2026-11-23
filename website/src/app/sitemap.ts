import type { MetadataRoute } from "next";
import { CHANGELOG_UPDATED } from "@/modules/changelog/content";
import { FAQ_UPDATED } from "@/modules/faq/content";
import { GUIDE_UPDATED } from "@/modules/guide/content";
import { PRIVACY_UPDATED } from "@/modules/privacy/content";
import { PATHS } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-static";

// Each page's lastmod is the same "Updated" date the page shows.
const ROUTES = [
  { path: PATHS.home, updated: CHANGELOG_UPDATED, priority: 1, changeFrequency: "weekly" },
  { path: PATHS.guide, updated: GUIDE_UPDATED, priority: 0.9, changeFrequency: "monthly" },
  { path: PATHS.faq, updated: FAQ_UPDATED, priority: 0.8, changeFrequency: "monthly" },
  { path: PATHS.changelog, updated: CHANGELOG_UPDATED, priority: 0.6, changeFrequency: "weekly" },
  { path: PATHS.privacy, updated: PRIVACY_UPDATED, priority: 0.5, changeFrequency: "yearly" },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(route.updated),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
