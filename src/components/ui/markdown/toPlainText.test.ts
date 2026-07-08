import { markdownToPlainText } from "@/components/ui/markdown/toPlainText";

describe("markdownToPlainText", () => {
  it("strips inline styling but keeps the words", () => {
    expect(markdownToPlainText("**bold** and *italic* and `code`")).toBe(
      "bold and italic and code",
    );
  });

  it("drops heading hashes", () => {
    expect(markdownToPlainText("### 29. Tomato basil pasta")).toBe(
      "29. Tomato basil pasta",
    );
  });

  it("keeps bullet lists as separate lines with a marker", () => {
    expect(markdownToPlainText("- pasta\n- tuna\n- basil")).toBe(
      "• pasta\n• tuna\n• basil",
    );
  });

  it("keeps ordered lists numbered from their start", () => {
    expect(markdownToPlainText("3. first\n4. second")).toBe(
      "3. first\n4. second",
    );
  });

  it("separates blocks with a blank line so structure survives", () => {
    const md = "# Recipes\n\n1. Tomato pasta\n2. Pesto pasta";
    expect(markdownToPlainText(md)).toBe(
      "Recipes\n\n1. Tomato pasta\n2. Pesto pasta",
    );
  });

  it("preserves fenced code verbatim", () => {
    expect(markdownToPlainText("```js\nconst a = 1;\n```")).toBe("const a = 1;");
  });
});
