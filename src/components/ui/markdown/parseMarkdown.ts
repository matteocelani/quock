// Minimal dependency-free markdown parser for the chat surface. Handles headings (1-6), fenced code, bullet lists, GFM pipe tables, paragraphs; inline code/bold/italic. Greedy left-to-right inline scan; code spans take priority over emphasis.

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string };

export type BlockNode =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
  | { type: "code"; lang?: string; value: string }
  | { type: "list"; items: InlineNode[][] }
  | { type: "orderedList"; start: number; items: InlineNode[][] }
  | { type: "blockquote"; children: BlockNode[] }
  | { type: "rule" }
  | { type: "table"; headers: InlineNode[][]; rows: InlineNode[][][] };
// A GFM table delimiter row is all dashes/colons/pipes, e.g. `|---|:--:|`. Requiring it on the line after the header is what stops a lone `|` paragraph from misfiring as a table.
function isTableDelimiter(line: string): boolean {
  return line.includes("-") && /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);
}
// Splits a `|`-delimited row into trimmed cells, dropping the optional outer pipes.
function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((cell) => cell.trim());
}
// Thematic break: 3+ of the same -, * or _ (spaces allowed between), nothing else on the line.
function isThematicBreak(line: string): boolean {
  return /^ {0,3}([-*_])( *\1){2,} *$/.test(line);
}
// True when a line opens a non-paragraph block, so the paragraph scanner stops before it instead of swallowing it.
function isBlockStart(line: string, next: string | undefined): boolean {
  return (
    line.startsWith("```") ||
    /^(#{1,6})\s+/.test(line) ||
    /^[-*] +/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^>\s?/.test(line) ||
    isThematicBreak(line) ||
    (line.includes("|") &&
      next !== undefined &&
      isTableDelimiter(next) &&
      !isTableDelimiter(line))
  );
}

/** Public entry point — accepts a markdown string and returns block nodes. */
export function parseMarkdown(source: string): BlockNode[] {
  const lines = source.split("\n");
  const blocks: BlockNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block — claims all lines until the closing fence.
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      // Robust to streaming partials: emit even if EOF arrives before the fence.
      if (i < lines.length) i += 1;
      const node: BlockNode = { type: "code", value: codeLines.join("\n") };
      if (lang.length > 0) node.lang = lang;
      blocks.push(node);
      continue;
    }
    // Heading — levels 1-6 (CommonMark). 7+ hashes isn't a heading, so it falls through to a paragraph.
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch !== null) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({
        type: "heading",
        level,
        children: parseInline(headingMatch[2]),
      });
      i += 1;
      continue;
    }
    // Thematic break. Checked before bullets so a spaced `- - -` / `* * *` isn't mistaken for a one-item list.
    if (isThematicBreak(line)) {
      blocks.push({ type: "rule" });
      i += 1;
      continue;
    }
    // GFM pipe table: a header row of `|`-separated cells followed by a delimiter row. Robust to streaming partials and ragged rows (cells normalised to the header column count).
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableDelimiter(lines[i + 1]) &&
      !isTableDelimiter(line)
    ) {
      const headers = splitTableRow(line).map(parseInline);
      const colCount = headers.length;
      i += 2;
      const rows: InlineNode[][][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        const cells = splitTableRow(lines[i]).map(parseInline);
        while (cells.length < colCount) cells.push([]);
        rows.push(cells.slice(0, colCount));
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    // Ordered list (1. 2. ...). The first item's number becomes `start` so rendering matches a list that doesn't begin at 1.
    const orderedMatch = /^(\d+)\.\s+/.exec(line);
    if (orderedMatch !== null) {
      const start = parseInt(orderedMatch[1], 10);
      const items: InlineNode[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\d+\.\s+/, "")));
        i += 1;
      }
      blocks.push({ type: "orderedList", start, items });
      continue;
    }
    // Bullet list — `- ` and `* ` both supported. Trailing space prevents line-start `*bold*` from looking like a bullet.
    if (/^[-*] +/.test(line)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && /^[-*] +/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^[-*] +/, "")));
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }
    // Blockquote — consecutive `>` lines. Inner content is parsed recursively so a quote can hold paragraphs, lists, etc.
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({
        type: "blockquote",
        children: parseMarkdown(quoteLines.join("\n")),
      });
      continue;
    }
    // Blank line — paragraph separator. Skip.
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    // Otherwise: paragraph. Greedily consume non-blank, non-special lines.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isBlockStart(lines[i], lines[i + 1])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    // Strip 2+ backtick runs (LLM noise that would render as empty chips) and collapse whitespace before inline parse.
    const sanitised = paraLines
      .join(" ")
      .replace(/`{2,}/g, "")
      .replace(/\s{2,}/g, " ");
    blocks.push({
      type: "paragraph",
      children: parseInline(sanitised),
    });
  }
  return blocks;
}
// Exported for tests; the renderer walks BlockNode children itself.
export function parseInline(input: string): InlineNode[] {
  const out: InlineNode[] = [];
  let i = 0;
  let textStart = 0;
  const flushText = (end: number): void => {
    if (end > textStart) {
      out.push({ type: "text", value: input.slice(textStart, end) });
    }
  };
  while (i < input.length) {
    const ch = input[i];
    // Code wins over emphasis. Skip whitespace-only spans (orphan LLM backticks) and trim so " python " becomes "python".
    if (ch === "`") {
      const close = input.indexOf("`", i + 1);
      if (close !== -1) {
        const trimmed = input.slice(i + 1, close).trim();
        if (trimmed.length === 0) {
          i = close + 1;
          continue;
        }
        flushText(i);
        out.push({ type: "code", value: trimmed });
        i = close + 1;
        textStart = i;
        continue;
      }
    }
    // Bold (CommonMark-ish: marker must hug non-whitespace on both sides, otherwise the asterisks stay as literal text).
    if (ch === "*" && input[i + 1] === "*") {
      const after = input[i + 2];
      if (after !== undefined && after !== " ") {
        let close = input.indexOf("**", i + 2);
        while (close !== -1 && input[close - 1] === " ") {
          close = input.indexOf("**", close + 1);
        }
        if (close !== -1) {
          flushText(i);
          out.push({ type: "bold", value: input.slice(i + 2, close) });
          i = close + 2;
          textStart = i;
          continue;
        }
      }
    }
    // Italic — same hug rule. Standalone bullet-like `*` between spaces stays as text.
    if (ch === "*" && input[i + 1] !== "*") {
      const after = input[i + 1];
      if (after !== undefined && after !== " ") {
        let close = input.indexOf("*", i + 1);
        while (close !== -1 && input[close - 1] === " ") {
          close = input.indexOf("*", close + 1);
        }
        if (close !== -1) {
          flushText(i);
          out.push({ type: "italic", value: input.slice(i + 1, close) });
          i = close + 1;
          textStart = i;
          continue;
        }
      }
    }
    i += 1;
  }
  flushText(input.length);
  return out;
}
