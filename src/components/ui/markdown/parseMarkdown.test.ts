import {
  parseInline,
  parseMarkdown,
} from "@/components/ui/markdown/parseMarkdown";
import { markdownToPlainText } from "@/components/ui/markdown/toPlainText";

describe("parseMarkdown", () => {
  it("emits a single paragraph for a single line of text", () => {
    const blocks = parseMarkdown("hello world");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", value: "hello world" }],
      },
    ]);
  });

  it("splits paragraphs on blank lines", () => {
    const blocks = parseMarkdown("first\n\nsecond");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      children: [{ type: "text", value: "first" }],
    });
    expect(blocks[1]).toEqual({
      type: "paragraph",
      children: [{ type: "text", value: "second" }],
    });
  });

  it("parses inline code", () => {
    const blocks = parseMarkdown("use `npm install` to begin");
    expect(blocks[0]).toEqual({
      type: "paragraph",
      children: [
        { type: "text", value: "use " },
        { type: "code", value: "npm install" },
        { type: "text", value: " to begin" },
      ],
    });
  });

  it("parses fenced code blocks with a language", () => {
    const src = [
      "```ts",
      "const x: number = 1;",
      "console.log(x);",
      "```",
    ].join("\n");
    const blocks = parseMarkdown(src);
    expect(blocks).toEqual([
      {
        type: "code",
        lang: "ts",
        value: "const x: number = 1;\nconsole.log(x);",
      },
    ]);
  });

  it("parses fenced code blocks without a language", () => {
    const src = "```\nplain text\n```";
    const blocks = parseMarkdown(src);
    expect(blocks).toEqual([{ type: "code", value: "plain text" }]);
  });

  it("parses bold text", () => {
    const blocks = parseMarkdown("**important** notice");
    expect(blocks[0]).toEqual({
      type: "paragraph",
      children: [
        { type: "bold", value: "important" },
        { type: "text", value: " notice" },
      ],
    });
  });

  it("parses italic text", () => {
    const blocks = parseMarkdown("an *emphasised* word");
    expect(blocks[0]).toEqual({
      type: "paragraph",
      children: [
        { type: "text", value: "an " },
        { type: "italic", value: "emphasised" },
        { type: "text", value: " word" },
      ],
    });
  });

  it("parses headings at levels 1 through 6", () => {
    const blocks = parseMarkdown(
      "# h1\n## h2\n### h3\n#### h4\n##### h5\n###### h6",
    );
    expect(blocks).toEqual([
      { type: "heading", level: 1, children: [{ type: "text", value: "h1" }] },
      { type: "heading", level: 2, children: [{ type: "text", value: "h2" }] },
      { type: "heading", level: 3, children: [{ type: "text", value: "h3" }] },
      { type: "heading", level: 4, children: [{ type: "text", value: "h4" }] },
      { type: "heading", level: 5, children: [{ type: "text", value: "h5" }] },
      { type: "heading", level: 6, children: [{ type: "text", value: "h6" }] },
    ]);
  });

  it("renders an #### section header instead of leaking the hashes (LLM bug)", () => {
    const blocks = parseMarkdown("#### 1. Registrazione");
    expect(blocks).toEqual([
      {
        type: "heading",
        level: 4,
        children: [{ type: "text", value: "1. Registrazione" }],
      },
    ]);
  });

  it("does not treat 7+ hashes as a heading (CommonMark caps at 6)", () => {
    const blocks = parseMarkdown("####### too deep");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", value: "####### too deep" }],
      },
    ]);
  });

  it("parses bullet lists", () => {
    const blocks = parseMarkdown("- one\n- two\n- three");
    expect(blocks).toEqual([
      {
        type: "list",
        items: [
          [{ type: "text", value: "one" }],
          [{ type: "text", value: "two" }],
          [{ type: "text", value: "three" }],
        ],
      },
    ]);
  });

  it("parses bullet lists with `*` markers (LLM-emitted)", () => {
    const blocks = parseMarkdown("* **Cannot** answer.\n* **Can** explain.");
    expect(blocks).toEqual([
      {
        type: "list",
        items: [
          [
            { type: "bold", value: "Cannot" },
            { type: "text", value: " answer." },
          ],
          [
            { type: "bold", value: "Can" },
            { type: "text", value: " explain." },
          ],
        ],
      },
    ]);
  });

  it("handles mixed content (heading + paragraph + list + code)", () => {
    const src = [
      "# Title",
      "",
      "Intro **bold** and `code`.",
      "",
      "- one",
      "- two",
      "",
      "```py",
      "print('hi')",
      "```",
    ].join("\n");

    const blocks = parseMarkdown(src);
    expect(blocks).toHaveLength(4);
    expect(blocks[0].type).toBe("heading");
    expect(blocks[1].type).toBe("paragraph");
    expect(blocks[2].type).toBe("list");
    expect(blocks[3]).toEqual({
      type: "code",
      lang: "py",
      value: "print('hi')",
    });
  });

  it("treats unmatched inline tokens as plain text", () => {
    // No closing backtick: the leading backtick stays inside text.
    const nodes = parseInline("foo `bar baz");
    expect(nodes).toEqual([{ type: "text", value: "foo `bar baz" }]);
  });

  it("preserves markdown chars inside fenced code", () => {
    const src = "```\n**not bold**\n```";
    const blocks = parseMarkdown(src);
    expect(blocks).toEqual([{ type: "code", value: "**not bold**" }]);
  });

  it("parses a GFM pipe table into headers + rows", () => {
    const src = [
      "| If you are | I can help |",
      "|------------|------------|",
      "| Writing | Story structure |",
      "| Gaming | Risks and contacts |",
    ].join("\n");
    const blocks = parseMarkdown(src);
    expect(blocks).toEqual([
      {
        type: "table",
        headers: [
          [{ type: "text", value: "If you are" }],
          [{ type: "text", value: "I can help" }],
        ],
        rows: [
          [
            [{ type: "text", value: "Writing" }],
            [{ type: "text", value: "Story structure" }],
          ],
          [
            [{ type: "text", value: "Gaming" }],
            [{ type: "text", value: "Risks and contacts" }],
          ],
        ],
      },
    ]);
  });

  it("parses inline emphasis inside table cells", () => {
    const src = ["| A | B |", "|---|:--:|", "| **x** | y |"].join("\n");
    const blocks = parseMarkdown(src);
    expect(blocks[0]).toMatchObject({
      type: "table",
      rows: [[[{ type: "bold", value: "x" }], [{ type: "text", value: "y" }]]],
    });
  });

  it("separates a table from a paragraph that hugs it with no blank line", () => {
    const src = ["Context:", "| A | B |", "|---|---|", "| 1 | 2 |"].join("\n");
    const blocks = parseMarkdown(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      children: [{ type: "text", value: "Context:" }],
    });
    expect(blocks[1].type).toBe("table");
  });

  it("pads ragged rows to the header column count", () => {
    const src = ["| A | B |", "|---|---|", "| 1 |"].join("\n");
    const blocks = parseMarkdown(src);
    expect(blocks[0]).toEqual({
      type: "table",
      headers: [
        [{ type: "text", value: "A" }],
        [{ type: "text", value: "B" }],
      ],
      rows: [[[{ type: "text", value: "1" }], []]],
    });
  });

  it("does not misfire on a lone pipe line without a delimiter row", () => {
    const blocks = parseMarkdown("a | b | c");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", value: "a | b | c" }],
      },
    ]);
  });

  it("parses an ordered list and keeps each item on its own line", () => {
    const blocks = parseMarkdown("1. **one**\n2. two\n3. three");
    expect(blocks).toEqual([
      {
        type: "orderedList",
        start: 1,
        items: [
          [{ type: "bold", value: "one" }],
          [{ type: "text", value: "two" }],
          [{ type: "text", value: "three" }],
        ],
      },
    ]);
  });

  it("preserves the starting number of an ordered list", () => {
    const blocks = parseMarkdown("3. three\n4. four");
    expect(blocks[0]).toMatchObject({ type: "orderedList", start: 3 });
  });

  it("parses a blockquote, recursing into its inner blocks", () => {
    const blocks = parseMarkdown("> **Note**: text");
    expect(blocks).toEqual([
      {
        type: "blockquote",
        children: [
          {
            type: "paragraph",
            children: [
              { type: "bold", value: "Note" },
              { type: "text", value: ": text" },
            ],
          },
        ],
      },
    ]);
  });

  it("parses a thematic break (---, ***, spaced)", () => {
    expect(parseMarkdown("---")).toEqual([{ type: "rule" }]);
    expect(parseMarkdown("***")).toEqual([{ type: "rule" }]);
    expect(parseMarkdown("- - -")).toEqual([{ type: "rule" }]);
  });

  it("separates a paragraph, a rule and an ordered list with no blank lines", () => {
    const src = ["Intro:", "---", "1. one", "2. two"].join("\n");
    const blocks = parseMarkdown(src);
    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "rule",
      "orderedList",
    ]);
  });

  it("parses a markdown link into a link node", () => {
    const nodes = parseInline("see [Ollama](https://ollama.com) docs");
    expect(nodes).toEqual([
      { type: "text", value: "see " },
      { type: "link", value: "Ollama", href: "https://ollama.com" },
      { type: "text", value: " docs" },
    ]);
  });

  it("parses a link inside an ordered-list item", () => {
    const blocks = parseMarkdown("1. [AccuWeather](https://accuweather.com)");
    expect(blocks).toEqual([
      {
        type: "orderedList",
        start: 1,
        items: [
          [
            {
              type: "link",
              value: "AccuWeather",
              href: "https://accuweather.com",
            },
          ],
        ],
      },
    ]);
  });

  it("leaves a malformed or empty link as plain text", () => {
    expect(parseInline("[label](")).toEqual([
      { type: "text", value: "[label](" },
    ]);
    expect(parseInline("[](https://x.com)")).toEqual([
      { type: "text", value: "[](https://x.com)" },
    ]);
  });

  it("parses inline math between single dollars", () => {
    expect(parseInline("the value $g$ is known")).toEqual([
      { type: "text", value: "the value " },
      { type: "math", value: "g" },
      { type: "text", value: " is known" },
    ]);
  });

  it("parses inline math in the escaped-parenthesis form", () => {
    expect(parseInline("the area \\(x^2\\) grows")).toEqual([
      { type: "text", value: "the area " },
      { type: "math", value: "x^2" },
      { type: "text", value: " grows" },
    ]);
  });

  it("leaves a lone price as text: nothing closes the span", () => {
    expect(parseInline("costs $5 in total")).toEqual([
      { type: "text", value: "costs $5 in total" },
    ]);
  });

  it("leaves two prices as text: the closing dollar sits after a space", () => {
    expect(parseInline("between $5 and $10 off")).toEqual([
      { type: "text", value: "between $5 and $10 off" },
    ]);
  });

  it("leaves a price range as text: digits and separators are not an equation", () => {
    expect(parseInline("costs $5-$10")).toEqual([
      { type: "text", value: "costs $5-$10" },
    ]);
  });

  it("leaves parenthesised prices as text: the span closes a bracket it never opened", () => {
    expect(parseInline("the price ($5) and the discount ($2)")).toEqual([
      { type: "text", value: "the price ($5) and the discount ($2)" },
    ]);
  });

  it("renders an escaped dollar as a literal, and it never opens math", () => {
    expect(parseInline("costs \\$5 and not \\$10")).toEqual([
      { type: "text", value: "costs $5 and not $10" },
    ]);
  });

  it("leaves a whole sentence of prices as text, however the dollars pair up", () => {
    const line =
      "costs $5, between $5 and $10, range $5-$10, the price ($5) and the discount ($2), and \\$20 off";
    expect(parseInline(line)).toEqual([
      {
        type: "text",
        value:
          "costs $5, between $5 and $10, range $5-$10, the price ($5) and the discount ($2), and $20 off",
      },
    ]);
  });

  it("keeps real math in the same sentence as the prices", () => {
    expect(parseInline("costs $5 but $g = 2$ is still math")).toEqual([
      { type: "text", value: "costs $5 but " },
      { type: "math", value: "g = 2" },
      { type: "text", value: " is still math" },
    ]);
  });

  it("never lets a math span reach across a code span", () => {
    expect(parseInline("costs $5 and the var `$PATH` counts")).toEqual([
      { type: "text", value: "costs $5 and the var " },
      { type: "code", value: "$PATH" },
      { type: "text", value: " counts" },
    ]);
  });

  it("leaves dollars inside a fenced block untouched", () => {
    expect(parseMarkdown("```sh\necho $HOME\n```")).toEqual([
      { type: "code", lang: "sh", value: "echo $HOME" },
    ]);
  });

  it("parses a multi-line display block, punctuation and all", () => {
    const src = [
      "$$",
      "\\begin{cases}",
      "g + m = 39 \\\\",
      "2g + 4m = 100",
      "\\end{cases}",
      "$$",
    ].join("\n");
    expect(parseMarkdown(src)).toEqual([
      {
        type: "math",
        value:
          "\\begin{cases}\ng + m = 39 \\\\\n2g + 4m = 100\n\\end{cases}",
      },
    ]);
  });

  it("parses the bracket display form", () => {
    expect(parseMarkdown("\\[x = 1\\]")).toEqual([
      { type: "math", value: "x = 1" },
    ]);
  });

  it("cuts the paragraph around display math written inline with the prose", () => {
    expect(parseMarkdown("System: $$g + m = 39$$ and then")).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", value: "System: " }],
      },
      { type: "math", value: "g + m = 39" },
      { type: "paragraph", children: [{ type: "text", value: " and then" }] },
    ]);
  });

  it("gives consecutive display equations a block each instead of one run-on line", () => {
    const blocks = parseMarkdown("So: $$78 + 2m = 100$$ $$2m = 22$$");
    expect(blocks).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "So: " }] },
      { type: "math", value: "78 + 2m = 100" },
      { type: "math", value: "2m = 22" },
    ]);
  });

  it("keeps the prose after a self-contained display span on the line", () => {
    expect(parseMarkdown("$$x = 1$$ and some text\nanother line")).toEqual([
      { type: "math", value: "x = 1" },
      {
        type: "paragraph",
        children: [{ type: "text", value: " and some text another line" }],
      },
    ]);
  });

  it("drops an orphan delimiter instead of circling on it", () => {
    expect(parseMarkdown("$$\n\ntext after")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "text after" }] },
    ]);
  });

  it("bounds an unterminated display block at the blank line", () => {
    expect(parseMarkdown("$$\n2m = 22\n\ntext after")).toEqual([
      { type: "math", value: "2m = 22" },
      { type: "paragraph", children: [{ type: "text", value: "text after" }] },
    ]);
  });

  it("parses math inside a heading", () => {
    expect(parseMarkdown("## Heading with $x^2$")).toEqual([
      {
        type: "heading",
        level: 2,
        children: [
          { type: "text", value: "Heading with " },
          { type: "math", value: "x^2" },
        ],
      },
    ]);
  });

  it("parses math inside table cells", () => {
    const md = [
      "| Quantity | Value |",
      "|---|---|",
      "| Mass $m$ | $4m = 100$ |",
    ].join("\n");
    expect(parseMarkdown(md)).toEqual([
      {
        type: "table",
        headers: [
          [{ type: "text", value: "Quantity" }],
          [{ type: "text", value: "Value" }],
        ],
        rows: [
          [
            [
              { type: "text", value: "Mass " },
              { type: "math", value: "m" },
            ],
            [{ type: "math", value: "4m = 100" }],
          ],
        ],
      },
    ]);
  });

  it("parses math inside a blockquote", () => {
    expect(parseMarkdown("> In short $2m = 22 \\implies m = 11$.")).toEqual([
      {
        type: "blockquote",
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", value: "In short " },
              { type: "math", value: "2m = 22 \\implies m = 11" },
              { type: "text", value: "." },
            ],
          },
        ],
      },
    ]);
  });

  // One long paragraph, 1200 dollars: the scan has to stay linear or streaming re-parses it once per chunk.
  it("parses a long dollar-heavy reply in one pass", () => {
    const source = "The cost is $5 and the estimate $x = 2$ still holds. ".repeat(
      400,
    );
    const blocks = parseMarkdown(source);
    expect(blocks).toHaveLength(1);
    const paragraph = blocks[0];
    if (paragraph.type !== "paragraph") throw new Error("expected a paragraph");
    expect(paragraph.children.filter((n) => n.type === "math")).toHaveLength(
      400,
    );
  });

  // Streaming re-parses a longer prefix on every chunk, so a half-arrived equation has to be a safe parse on its own.
  it("survives every prefix of a streamed reply", () => {
    const reply = [
      "## Solution",
      "",
      "This is a classic system of equations.",
      "",
      "$$",
      "\\begin{cases}",
      "g + m = 39 \\\\",
      "2g + 4m = 100",
      "\\end{cases}",
      "$$",
      "",
      "Substituting: $$2(39 - m) + 4m = 100$$ $$78 + 2m = 100$$",
      "",
      "Check: heads $28 + 11 = 39$, legs $(28 \\times 2) + (11 \\times 4) = 100$.",
    ].join("\n");
    const settled = "This is a classic system of equations.";
    for (let end = 1; end <= reply.length; end += 1) {
      const partial = reply.slice(0, end);
      for (const block of parseMarkdown(partial)) {
        if (block.type !== "math") continue;
        // An open delimiter must never reach forward into the prose that follows it.
        expect(block.value).not.toContain("Substituting");
        expect(block.value).not.toContain("Check");
      }
      // Whatever has already landed stays readable while the rest is still arriving.
      if (partial.includes(settled)) {
        expect(markdownToPlainText(partial)).toContain(settled);
      }
    }
  });

  it("keeps display math inline inside a list item, with no orphan dollars", () => {
    expect(parseMarkdown("- result: $$m = 11$$")).toEqual([
      {
        type: "list",
        items: [
          [
            { type: "text", value: "result: " },
            { type: "math", value: "m = 11" },
          ],
        ],
      },
    ]);
  });
});
