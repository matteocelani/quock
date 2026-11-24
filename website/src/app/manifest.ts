import type { MetadataRoute } from "next";
import { PATHS, SITE, THEME_COLOR } from "@/lib/site";

export const dynamic = "force-static";

// The size `pnpm assets` writes src/app/icon.png at; the script reads it from here.
const ICON_SIZE = 512;

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: PATHS.home,
    display: "browser",
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
    icons: [{ src: "/icon.png", sizes: `${ICON_SIZE}x${ICON_SIZE}`, type: "image/png" }],
    related_applications: [{ platform: "itunes", url: SITE.appStoreUrl, id: SITE.appStoreId }],
  };
}
