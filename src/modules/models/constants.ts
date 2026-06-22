// Models module constants — model picker layout, cloud-models cache lifetime, and capability detection.

// 75% snap matches Settings — room for filter pills + list while keeping the screen behind visible.
export const MODEL_PICKER_SHEET_SNAP = "75%" as const;
// Delay before closing the picker after a selection so the radio animation is visible.
export const SHEET_CLOSE_DELAY_MS = 220;
export const CLOUD_MODELS_STALE_TIME_MS = 60 * 60 * 1000;
// Capabilities don't change once a model release is published; only the catalogue (which models EXIST) churns.
export const MODEL_CAPABILITIES_STALE_TIME_MS = 24 * 60 * 60 * 1000;
// One retry tolerates a momentary 5xx but doesn't burn 6 attempts on a 404 (= endpoint not exposed by this cloud build).
export const MODEL_CAPABILITIES_RETRY = 1;
// Wire values returned by /api/show inside the `capabilities[]` array.
export const VISION_CAPABILITY = "vision";
export const THINKING_CAPABILITY = "thinking";
export const TOOLS_CAPABILITY = "tools";
export const COMPLETION_CAPABILITY = "completion";
// Default-model fallback priority — lower-case substring match, first hit wins. Absent keys are skipped and
// pickDefault falls back to the first available model, so a churned catalogue still resolves to something usable.
export const DEFAULT_MODEL_PRIORITY: readonly string[] = [
  "kimi",
  "gemma",
  "gpt-oss",
  "qwen",
  "llama",
];
