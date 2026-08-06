// Wording for the excerpt actions, each sent as a fresh user turn. The user may reword the INSTRUCTION in Settings; the
// excerpt is always appended by `excerptPrompt`, so an editable `{excerpt}` placeholder can never be lost.
export const DEFAULT_DEEP_DIVE_INSTRUCTION =
  "Expand on this in depth — detail, reasoning, examples, caveats:";

export const DEFAULT_WEB_SEARCH_INSTRUCTION =
  "Search the web and summarise the current, sourced facts on this:";

export function excerptPrompt(instruction: string, excerpt: string): string {
  return `${instruction}\n\n"${excerpt}"`;
}
