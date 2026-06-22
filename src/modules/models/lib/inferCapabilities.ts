// Heuristic capability inference for the model picker; the `general` baseline is dropped so only actual capability flags ever render as chips. Used ONLY when /api/show doesn't answer.

import {
  COMPLETION_CAPABILITY,
  THINKING_CAPABILITY,
  TOOLS_CAPABILITY,
  VISION_CAPABILITY,
} from "@/modules/models/constants";

// Substring match against the lowered model name. List is generous on purpose: false positives just show an extra chip; false negatives hide a feature affordance (worse UX). Synced with ollama.com/search?c=cloud mid-2026.
const VISION_HINT_NAMES: readonly string[] = [
  // Generic markers
  "vision",
  "-vl",
  "vl-",
  "multimodal",
  "llava",
  "moondream",
  "minicpm-v",
  // Llama
  "llama-3.2-vision",
  "llama-4",
  // Gemma 3 / 4 (multimodal across the family)
  "gemma3",
  "gemma4",
  // Qwen
  "qwen2-vl",
  "qwen2.5-vl",
  "qwen3-vl",
  "qwen3.5",
  // OpenAI open-weights — gpt-oss:120b is multimodal in the catalogue
  "gpt-oss:120b",
  // Mistral multimodal
  "pixtral",
  "mistral-large-3",
  "ministral-3",
  "devstral-small-2",
  // MiniMax
  "minimax-m3",
  // Moonshot Kimi multimodal series
  "kimi-k2.5",
  "kimi-k2.6",
  // Google Gemini
  "gemini-3-flash",
];

// Models that ship `/v1/chat/completions` tool/function-calling. Practically every modern cloud model has tools — the heuristic is broad on purpose so we don't accidentally hide the badge.
const TOOL_HINT_NAMES: readonly string[] = [
  "gpt-oss",
  "llama-3.3",
  "llama-3.1",
  "llama-4",
  "qwen2.5",
  "qwen3",
  "qwen-2.5",
  "qwen3.5",
  "mistral",
  "command-r",
  // Cloud-only families (all carry the `tools` tag on ollama.com)
  "kimi",
  "minimax",
  "glm-",
  "deepseek",
  "nemotron",
  "rnj-",
  "devstral",
  "ministral",
  "gemini-3",
  "gemma4",
];

// Models that emit `<think>` tokens / accept the `think: true` parameter. Conservative on purpose — flagging "thinking" on a non-thinking model would expose the toggle in Composer that does nothing.
const THINKING_HINT_NAMES: readonly string[] = [
  // Generic markers
  "thinking",
  "reasoning",
  "-r1",
  ":r1",
  // OpenAI-style reasoning
  "o1",
  "gpt-oss",
  // DeepSeek reasoning family (V3+ supports hybrid mode)
  "deepseek-v3",
  "deepseek-v4",
  "deepseek-r1",
  // Moonshot
  "kimi-k2-thinking",
  "kimi-k2.5",
  "kimi-k2.6",
  // Z.ai GLM
  "glm-4.6",
  "glm-4.7",
  "glm-5",
  // MiniMax
  "minimax-m2",
  "minimax-m2.5",
  "minimax-m2.7",
  "minimax-m3",
  // NVIDIA
  "nemotron-3",
  // Qwen
  "qwen3-next",
  "qwen3-vl",
  "qwen3.5",
  // Google
  "gemini-3-flash",
  "gemma4",
];

// Server-side baseline that we strip before rendering chips — every text-gen model carries it, so it adds no signal.
const BASELINE_CHIP = "general";

function nameMatchesAny(name: string, haystack: readonly string[]): boolean {
  const lowered = name.toLowerCase();
  return haystack.some((hint) => lowered.includes(hint.toLowerCase()));
}

// Returns a deduplicated, stable-ordered list of capability chips for `name`; may be empty when no recognized flag fits.
export function inferCapabilities(
  name: string,
  explicit?: readonly string[],
): readonly string[] {
  // Trust the server when it populates the capability array, but never re-introduce the `general` baseline.
  if (explicit && explicit.length > 0) {
    const seen = new Set<string>(
      explicit.filter((chip) => chip !== BASELINE_CHIP),
    );
    return Array.from(seen);
  }
  const chips: string[] = [COMPLETION_CAPABILITY];
  if (nameMatchesAny(name, VISION_HINT_NAMES)) chips.push(VISION_CAPABILITY);
  if (nameMatchesAny(name, TOOL_HINT_NAMES)) chips.push(TOOLS_CAPABILITY);
  if (nameMatchesAny(name, THINKING_HINT_NAMES)) chips.push(THINKING_CAPABILITY);
  return chips;
}
