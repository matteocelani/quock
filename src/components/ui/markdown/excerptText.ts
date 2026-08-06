// Resolves a unit key back to its plain text, so the excerpt is derived from the reply on demand rather than mirrored
// into the UI store — the same contract the select-text sheet follows.

import { groupIntoUnits } from "@/components/ui/markdown/groupIntoUnits";
import { parseMarkdown } from "@/components/ui/markdown/parseMarkdown";

export function excerptTextForKey(source: string, unitKey: string): string {
  for (const unit of groupIntoUnits(parseMarkdown(source))) {
    if ("itemKeys" in unit) {
      const index = unit.itemKeys.indexOf(unitKey);
      if (index >= 0) return unit.itemTexts[index] ?? "";
      continue;
    }
    if (unit.key === unitKey) return unit.text;
  }
  return "";
}
