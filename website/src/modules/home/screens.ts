export type ScreenName = "home" | "open_model" | "compose" | "chat" | "history" | "settings";

// Size of the framed captures. compose-assets.py reads the width and stops if the height no longer matches.
export const SHOT_WIDTH = 840;
export const SHOT_HEIGHT = 1714;

export function screenSrc(screen: ScreenName): string {
  return `/screens/${screen}-${SHOT_WIDTH}.webp`;
}

// Alt text lives with the screen, so every place that shows a capture describes it the same way.
export const SCREEN_ALT: Record<ScreenName, string> = {
  home: "Quock's home screen: a model picker at the top and a message field at the bottom",
  open_model: "Quock's model picker listing Ollama Cloud models with vision and thinking badges",
  compose: "The attach sheet with camera, photo and file buttons and toggles for web search and thinking",
  chat: "A Quock chat showing the model's collapsible thinking and a step-by-step answer",
  history: "The chat list page with a search field and today's conversations",
  settings: "Quock's settings in dark mode with theme, haptics and default model options",
};

// Model names exactly as the picker capture shows them (docs/screenshots/open_model.png).
export const MODELS = [
  { name: "glm-5.3-flash", tags: ["vision", "thinking"] },
  { name: "glm-5.2", tags: ["thinking"] },
  { name: "minimax-m3", tags: ["vision", "thinking"] },
  { name: "kimi-k2.7-code", tags: ["vision", "thinking"] },
  { name: "gpt-oss:20b", tags: ["thinking"] },
  { name: "gemma4:31b", tags: ["vision", "thinking"] },
  { name: "kimi-k2.6", tags: ["vision", "thinking"] },
] as const;

// The model the picker capture shows as chosen, so the hero stage opens on the same one.
export const PICKED_MODEL = "glm-5.2" satisfies (typeof MODELS)[number]["name"];
