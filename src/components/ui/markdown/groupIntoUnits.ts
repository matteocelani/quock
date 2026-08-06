// Groups parsed blocks into long-press "excerpt units": a heading glues its body into one section, outside a heading
// each block is atomic, and a top-level list atomizes to items. Keys are stable so the UI can highlight one unit.

import { type BlockNode } from "@/components/ui/markdown/parseMarkdown";
import {
  blockToPlainText,
  inlineToPlainText,
} from "@/components/ui/markdown/toPlainText";

// One entry per source block: a single unit (text + key), or per-item entries for a top-level list that atomizes.
export type ExcerptUnit =
  | { key: string; text: string }
  | { itemKeys: string[]; itemTexts: string[] };

export function groupIntoUnits(blocks: BlockNode[]): ExcerptUnit[] {
  // Assign every block to a heading section (flat — each heading opens a new one) or leave it standalone.
  const sections: number[][] = [];
  const sectionOf = new Array<number>(blocks.length).fill(-1);
  let current = -1;
  blocks.forEach((block, i) => {
    if (block.type === "heading") {
      current = sections.length;
      sections.push([i]);
      sectionOf[i] = current;
    } else if (current >= 0) {
      sections[current].push(i);
      sectionOf[i] = current;
    }
  });
  const sectionText = sections.map((indices) =>
    indices
      .map((idx) => blockToPlainText(blocks[idx]))
      .filter((t) => t.length > 0)
      .join("\n\n"),
  );
  return blocks.map((block, i) => {
    const sid = sectionOf[i];
    if (sid >= 0) return { key: `s${sid}`, text: sectionText[sid] };
    // Standalone (no governing heading): a list atomizes to its items, everything else is its own block.
    if (block.type === "list" || block.type === "orderedList") {
      return {
        itemKeys: block.items.map((_, j) => `b${i}i${j}`),
        itemTexts: block.items.map((item) => inlineToPlainText(item)),
      };
    }
    return { key: `b${i}`, text: blockToPlainText(block) };
  });
}
