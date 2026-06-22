import {
  parseInline,
  parseMarkdown,
} from "@/components/ui/markdown/parseMarkdown";

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
});
