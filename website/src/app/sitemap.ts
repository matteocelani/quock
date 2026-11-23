import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-static";

const ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/ollama-cloud-on-iphone/", priority: 0.9, changeFrequency: "monthly" },
  { path: "/faq/", priority: 0.8, changeFrequency: "monthly" },
  { path: "/changelog/", priority: 0.6, changeFrequency: "weekly" },
  { path: "/privacy/", priority: 0.5, changeFrequency: "yearly" },
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
