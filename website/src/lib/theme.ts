// The custom @theme names in globals.css, grouped the way tailwind-merge groups classes, so cn() reads
// text-ui as a size and not a colour. next.config.ts stops the build if this list and globals.css disagree.
export const THEME_TOKENS: Record<"text" | "shadow" | "radius" | "tracking" | "leading" | "ease" | "container", string[]> = {
  text: ["display-sm", "section-sm", "section", "lead", "body", "ui", "mock", "chip", "tag"],
  shadow: ["raised", "card", "float"],
  radius: ["tile", "stage", "icon"],
  tracking: ["display", "section", "feature", "title"],
  leading: ["display", "section", "lead"],
  ease: ["spring", "glide"],
  container: ["reading", "content", "hero", "stage"],
};
