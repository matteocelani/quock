import {
  mathToPlainText,
  mathToSegments,
} from "@/components/ui/markdown/mathText";

describe("mathToPlainText", () => {
  it("maps the operators models actually emit", () => {
    expect(mathToPlainText("2 \\times 3 \\neq 7")).toBe("2 × 3 ≠ 7");
    expect(mathToPlainText("2m = 22 \\implies m = 11")).toBe(
      "2m = 22 ⟹ m = 11",
    );
    expect(mathToPlainText("\\alpha + \\beta \\leq \\pi")).toBe("α + β ≤ π");
  });

  it("lifts the words out of a text wrapper and drops the alignment marker", () => {
    expect(mathToPlainText("g + m = 39 & \\text{(heads)}")).toBe(
      "g + m = 39 (heads)",
    );
  });

  it("stacks a cases environment one row per line", () => {
    const latex = "\\begin{cases} g + m = 39 \\\\ 2g + 4m = 100 \\end{cases}";
    expect(mathToPlainText(latex)).toBe("g + m = 39\n2g + 4m = 100");
  });

  it("writes a fraction on one line, bracketing a composite part", () => {
    expect(mathToPlainText("\\frac{1}{2}")).toBe("1/2");
    expect(mathToPlainText("\\frac{a+b}{c}")).toBe("(a+b)/c");
  });

  it("writes a root inline, bracketing a composite radicand", () => {
    expect(mathToPlainText("\\sqrt{16}")).toBe("√16");
    expect(mathToPlainText("\\sqrt{a+b}")).toBe("√(a+b)");
  });

  it("raises and lowers scripts into Unicode when every character has a tier", () => {
    expect(mathToPlainText("E = mc^2")).toBe("E = mc²");
    expect(mathToPlainText("x_1 + x_2")).toBe("x₁ + x₂");
    expect(mathToPlainText("\\int_0^1 x^2 dx")).toBe("∫₀¹ x² dx");
  });

  it("falls back to a literal script when a character has no tier", () => {
    expect(mathToPlainText("x^{a+b}")).toBe("x^(a+b)");
  });

  it("reads a braceless command as one argument, not as a lone backslash", () => {
    expect(mathToPlainText("\\int_0^\\infty")).toBe("∫₀^∞");
    expect(mathToPlainText("\\frac\\alpha\\beta")).toBe("α/β");
    expect(mathToPlainText("\\sqrt\\pi")).toBe("√π");
  });

  it("carries the marks a model closes a verification with", () => {
    expect(mathToPlainText("g + m = 39 \\checkmark")).toBe("g + m = 39 ✓");
    expect(mathToPlainText("x = 1 \\therefore y = 2")).toBe("x = 1 ∴ y = 2");
    expect(mathToPlainText("90^\\circ")).toBe("90°");
  });

  it("unwraps a boxed answer and drops a sizing directive", () => {
    expect(mathToPlainText("\\boxed{28}")).toBe("28");
    expect(mathToPlainText("\\displaystyle \\frac{1}{2}")).toBe("1/2");
  });

  it("keeps function names as upright words", () => {
    expect(mathToPlainText("\\sin x + \\log n")).toBe("sin x + log n");
  });

  it("drops a decoration it cannot draw and keeps what it decorated", () => {
    expect(mathToPlainText("\\vec{v} \\cdot \\mathbb{R}")).toBe("v · R");
  });

  it("leaves an unknown command visible rather than inventing a word", () => {
    expect(mathToPlainText("\\zzz")).toBe("\\zzz");
  });

  it("returns nothing for an empty span", () => {
    expect(mathToPlainText("   ")).toBe("");
  });

  // Half-written LaTeX is the normal state of a streaming reply, not a rare accident.
  it("degrades without throwing on a half-arrived command", () => {
    const partials = [
      "\\frac{22",
      "\\sqrt{",
      "\\text{heads",
      "\\begin{cases} a = 1",
      "x^",
      "\\",
      "{{{",
      "}}}",
    ];
    for (const partial of partials) {
      expect(() => mathToPlainText(partial)).not.toThrow();
    }
    // What the reader can already see survives the malformed wrapper around it.
    expect(mathToPlainText("\\text{heads")).toContain("heads");
    expect(mathToPlainText("\\begin{cases} a = 1")).toContain("a = 1");
  });

  it("survives deeply nested groups", () => {
    const deep = "\\frac{1}{".repeat(60) + "2" + "}".repeat(60);
    expect(() => mathToPlainText(deep)).not.toThrow();
  });
});

describe("mathToSegments", () => {
  it("marks single letters as variables and leaves the rest upright", () => {
    expect(mathToSegments("2g + 4m")).toEqual([
      { text: "2", isVariable: false },
      { text: "g", isVariable: true },
      { text: " + 4", isVariable: false },
      { text: "m", isVariable: true },
    ]);
  });

  it("leaves capital Greek upright, the way a math font sets it", () => {
    expect(mathToSegments("\\Delta x")).toEqual([
      { text: "Δ ", isVariable: false },
      { text: "x", isVariable: true },
    ]);
  });

  it("keeps a function name upright, merged with the run around it", () => {
    expect(mathToSegments("\\sin x")).toEqual([
      { text: "sin ", isVariable: false },
      { text: "x", isVariable: true },
    ]);
  });
});
