import { excerptTextForKey } from "@/components/ui/markdown/excerptText";
import { groupIntoUnits } from "@/components/ui/markdown/groupIntoUnits";
import { parseMarkdown } from "@/components/ui/markdown/parseMarkdown";

const SOURCE = "## Caveats\n\nMind the gap.\n\n- first item\n- second item\n";

function firstKey(source: string): string {
  const unit = groupIntoUnits(parseMarkdown(source))[0];
  return "itemKeys" in unit ? unit.itemKeys[0] : unit.key;
}

describe("excerptTextForKey", () => {
  it("resolves a section unit", () => {
    const key = firstKey(SOURCE);
    expect(excerptTextForKey(SOURCE, key)).toContain("Mind the gap.");
  });

  it("resolves a standalone list item, not the whole list", () => {
    const list = "- first item\n- second item\n";
    const key = firstKey(list);
    expect(excerptTextForKey(list, key)).toBe("first item");
  });

  it("returns empty for a key that no longer exists after an edit", () => {
    expect(excerptTextForKey(SOURCE, "s99")).toBe("");
  });
});
