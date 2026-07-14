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

  it("keeps a link's visible text and drops the URL", () => {
    expect(markdownToPlainText("[Ollama](https://ollama.com)")).toBe("Ollama");
  });

  it("renders a two-column table as key/value pairs", () => {
    const md = [
      "| Field | Value |",
      "|---|---|",
      "| Max temp | 26 |",
      "| Sky | Cloudy |",
    ].join("\n");
    expect(markdownToPlainText(md)).toBe("Max temp: 26\nSky: Cloudy");
  });

  it("renders a wider table as one labelled block per row", () => {
    const md = [
      "| Day | Temp | Sky |",
      "|---|---|---|",
      "| Mon | 26 | Cloudy |",
      "| Tue | 28 | Clear |",
    ].join("\n");
    expect(markdownToPlainText(md)).toBe(
      "Day: Mon\nTemp: 26\nSky: Cloudy\n\nDay: Tue\nTemp: 28\nSky: Clear",
    );
  });
});
