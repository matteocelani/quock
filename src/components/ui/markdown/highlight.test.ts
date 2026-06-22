import {
  highlightCode,
  type HighlightedSegment,
} from "@/components/ui/markdown/highlight";

function totalLength(segments: HighlightedSegment[]): number {
  return segments.reduce((sum, s) => sum + s.text.length, 0);
}

describe("highlightCode", () => {
  it("is lossless — segments preserve the entire source", () => {
    const sources: [string, string][] = [
      ["const x = 42", "ts"],
      ["// hello", "ts"],
      ["def foo():\n    return 1", "python"],
      ['{"a": 1, "b": true}', "json"],
      ["anything goes here", "unknown-lang"],
    ];
    for (const [src, lang] of sources) {
      expect(totalLength(highlightCode(src, lang))).toBe(src.length);
    }
  });

  it("falls back to a single plain segment for an unknown language", () => {
    expect(highlightCode("anything", "unknown-lang")).toEqual([
      { text: "anything", kind: "plain" },
    ]);
  });
});
