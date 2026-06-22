// Drop the Ollama `:cloud` / `-cloud` suffix from the wire-level model name so the UI shows "kimi-k2.6" instead of "kimi-k2.6:cloud" and "qwen3-vl:235b" instead of "qwen3-vl:235b-cloud". On Quock everything runs cloud, so the suffix is noise. The wire-level name (passed to `/api/chat`) is left untouched by callers — this is a display-only transform.

export function formatModelName(name: string): string {
  return name.replace(/:cloud$/, "").replace(/-cloud$/, "");
}
