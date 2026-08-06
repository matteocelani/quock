import { parseMarkdown } from "@/components/ui/markdown/parseMarkdown";
import { groupIntoUnits } from "@/components/ui/markdown/groupIntoUnits";

function units(md: string): ReturnType<typeof groupIntoUnits> {
  return groupIntoUnits(parseMarkdown(md));
}

describe("groupIntoUnits", () => {
  it("glues a heading with its body into one keyed section", () => {
    const u = units("## Recipe\n\nIngredients: pasta\n\nBoil it.");
    const section = "Recipe\n\nIngredients: pasta\n\nBoil it.";
    expect(u).toEqual([
      { key: "s0", text: section },
      { key: "s0", text: section },
      { key: "s0", text: section },
    ]);
  });

  it("starts a fresh section at every heading (flat, no nesting)", () => {
    const u = units("## A\n\naaa\n\n### B\n\nbbb");
    expect(u).toEqual([
      { key: "s0", text: "A\n\naaa" },
      { key: "s0", text: "A\n\naaa" },
      { key: "s1", text: "B\n\nbbb" },
      { key: "s1", text: "B\n\nbbb" },
    ]);
  });

  it("atomizes a top-level list to per-item keys and texts", () => {
    expect(units("- pasta\n- tuna\n- basil")).toEqual([
      {
        itemKeys: ["b0i0", "b0i1", "b0i2"],
        itemTexts: ["pasta", "tuna", "basil"],
      },
    ]);
  });

  it("keeps a list inside a section as part of the section", () => {
    const u = units("## Recipe\n\n- pasta\n- tuna");
    const section = "Recipe\n\n• pasta\n• tuna";
    expect(u).toEqual([
      { key: "s0", text: section },
      { key: "s0", text: section },
    ]);
  });

  it("keeps headless paragraphs atomic with their own keys", () => {
    expect(units("First point.\n\nSecond point.")).toEqual([
      { key: "b0", text: "First point." },
      { key: "b1", text: "Second point." },
    ]);
  });

  it("leaves content before the first heading standalone", () => {
    const u = units("Intro line.\n\n## Sec\n\nBody.");
    expect(u).toEqual([
      { key: "b0", text: "Intro line." },
      { key: "s0", text: "Sec\n\nBody." },
      { key: "s0", text: "Sec\n\nBody." },
    ]);
  });

  it("folds a code block into its section (deep-dive gets code + context)", () => {
    const u = units("## Fix\n\nDo this:\n\n```js\nconst a = 1;\n```");
    const section = "Fix\n\nDo this:\n\nconst a = 1;";
    expect(u).toEqual([
      { key: "s0", text: section },
      { key: "s0", text: section },
      { key: "s0", text: section },
    ]);
  });
});
