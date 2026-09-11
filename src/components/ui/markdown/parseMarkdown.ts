// Minimal dependency-free markdown parser for the chat surface. Handles headings (1-6), fenced code, bullet lists, GFM pipe tables, display math, paragraphs; inline code/bold/italic/links/math. Greedy left-to-right inline scan; code spans take priority over emphasis and links.

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "math"; value: string }
  | { type: "link"; value: string; href: string };

export type BlockNode =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
  | { type: "code"; lang?: string; value: string }
  | { type: "math"; value: string }
  | { type: "list"; items: InlineNode[][] }
  | { type: "orderedList"; start: number; items: InlineNode[][] }
  | { type: "blockquote"; children: BlockNode[] }
  | { type: "rule" }
  | { type: "table"; headers: InlineNode[][]; rows: InlineNode[][][] };
// Both LaTeX display forms; models pick either, sometimes both in one reply.
const DISPLAY_DELIMITERS = [
  { open: "$$", close: "$$" },
  { open: "\\[", close: "\\]" },
] as const;
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
// A delimiter opening a block the line never closes. A self-contained `$$…$$` is deliberately NOT one: it stays with
// its paragraph, where the splitter can cut the prose around it instead of the scan swallowing the lines below.
function openDisplayDelimiter(
  line: string,
): (typeof DISPLAY_DELIMITERS)[number] | null {
  const trimmed = line.trim();
  for (const delimiter of DISPLAY_DELIMITERS) {
    if (!trimmed.startsWith(delimiter.open)) continue;
    const rest = trimmed.slice(delimiter.open.length);
    return rest.includes(delimiter.close) ? null : delimiter;
  }
  return null;
}
// A display block claimed line-by-line rather than inside the paragraph, so a `-` or `|` in the equation is never read
// as a bullet or a table row. A blank line ends it: an unterminated `$$` then costs one paragraph, not the whole reply.
function readDisplayMath(
  lines: string[],
  start: number,
): { value: string; next: number } | null {
  const delimiter = openDisplayDelimiter(lines[start]);
  if (delimiter === null) return null;
  const head = lines[start].trim().slice(delimiter.open.length);
  const body: string[] = head.trim().length > 0 ? [head] : [];
  let i = start + 1;
  while (i < lines.length && lines[i].trim() !== "") {
    const current = lines[i].trim();
    if (current.endsWith(delimiter.close)) {
      const tail = current.slice(0, -delimiter.close.length);
      if (tail.trim().length > 0) body.push(tail);
      return { value: body.join("\n"), next: i + 1 };
    }
    body.push(lines[i]);
    i += 1;
  }
  // Unterminated: emit what arrived, so a streaming equation forms in place the way a fenced code block does. `next`
  // always moves past the opener, or an orphan `$$` would leave the block scanner circling the same line.
  return { value: body.join("\n"), next: i };
}

interface ParagraphPart {
  value: string;
  isMath: boolean;
}
// Display math written inline with the prose (`System: $$x = 1$$`) still owns its own line, so the paragraph is cut
// around it instead of the equation being dragged into the text flow.
function splitDisplayMath(text: string): ParagraphPart[] {
  const parts: ParagraphPart[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let found: { start: number; end: number; value: string } | null = null;
    for (const delimiter of DISPLAY_DELIMITERS) {
      const start = text.indexOf(delimiter.open, cursor);
      if (start === -1) continue;
      const from = start + delimiter.open.length;
      const close = text.indexOf(delimiter.close, from);
      if (close === -1) continue;
      const value = text.slice(from, close);
      if (value.trim().length === 0) continue;
      if (found === null || start < found.start) {
        found = { start, end: close + delimiter.close.length, value };
      }
    }
    if (found === null) break;
    if (found.start > cursor) {
      parts.push({ value: text.slice(cursor, found.start), isMath: false });
    }
    parts.push({ value: found.value, isMath: true });
    cursor = found.end;
  }
  if (cursor < text.length) {
    parts.push({ value: text.slice(cursor), isMath: false });
  }
  return parts;
}
// True when a line opens a non-paragraph block, so the paragraph scanner stops before it instead of swallowing it.
function isBlockStart(line: string, next: string | undefined): boolean {
  return (
    line.startsWith("```") ||
    openDisplayDelimiter(line) !== null ||
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
    // Display math opening its own line — claimed before every other block so the equation's own punctuation is safe.
    const display = readDisplayMath(lines, i);
    if (display !== null) {
      // An orphan delimiter carries no equation; it is dropped the way an orphan backtick already is.
      if (display.value.trim().length > 0) {
        blocks.push({ type: "math", value: display.value });
      }
      i = display.next;
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
    for (const part of splitDisplayMath(sanitised)) {
      if (part.isMath) {
        blocks.push({ type: "math", value: part.value });
        continue;
      }
      if (part.value.trim().length === 0) continue;
      blocks.push({
        type: "paragraph",
        children: parseInline(part.value),
      });
    }
  }
  return blocks;
}
// A span of digits and separators is a price range ("$5-$10"), never an equation.
const NUMERIC_ONLY = /^[\d.,\s+-]+$/;
// Two words is prose the scan wandered into, not a formula — unless a command marks the span as real LaTeX.
const PROSE_WORDS = /[A-Za-z]{2,}[^A-Za-z]+[A-Za-z]{2,}/;
// A parenthesis the span opens but never closes means the pairing ran past where the prose does ("$10, the price (").
function hasBalancedParens(value: string): boolean {
  let depth = 0;
  for (const char of value) {
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}
// `\$` is a literal dollar, so it can never close a math span.
function indexOfUnescapedDollar(input: string, from: number): number {
  for (let i = from; i < input.length; i += 1) {
    if (input[i] === "$" && input[i - 1] !== "\\") return i;
  }
  return -1;
}
// Model prose is full of prices, and one sentence can hold enough dollars to pair up several wrong ways. A span is
// math only when it reads like math from every side, so an ambiguous pair stays the literal text the reader expects.
function isInlineMath(value: string, after: string | undefined): boolean {
  if (value.length === 0) return false;
  if (value.startsWith(" ") || value.endsWith(" ")) return false;
  if (NUMERIC_ONLY.test(value)) return false;
  if (value.includes("`") || value.includes("\n")) return false;
  // A digit straight after the closer is the second half of a price pair, never the character following an equation.
  if (after !== undefined && /\d/.test(after)) return false;
  if (!hasBalancedParens(value)) return false;
  return !PROSE_WORDS.test(value) || value.includes("\\");
}

// The `\$` escape emits its literal mid-run, so a stretch of prose would otherwise arrive as two text nodes.
function mergeText(nodes: InlineNode[]): InlineNode[] {
  const merged: InlineNode[] = [];
  for (const node of nodes) {
    const previous = merged[merged.length - 1];
    if (node.type === "text" && previous?.type === "text") {
      merged[merged.length - 1] = {
        type: "text",
        value: previous.value + node.value,
      };
      continue;
    }
    merged.push(node);
  }
  return merged;
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
    // A model writing about money escapes the sign, and `\(x\)` is the other inline math form.
    if (ch === "\\") {
      const next = input[i + 1];
      if (next === "$") {
        flushText(i);
        out.push({ type: "text", value: "$" });
        i += 2;
        textStart = i;
        continue;
      }
      if (next === "(") {
        const close = input.indexOf("\\)", i + 2);
        if (close !== -1) {
          const value = input.slice(i + 2, close);
          if (value.trim().length > 0) {
            flushText(i);
            out.push({ type: "math", value });
            i = close + 2;
            textStart = i;
            continue;
          }
        }
      }
    }
    // Inline math. `$$…$$` reaching here is display math inside a row no block can split — a list item, a table cell.
    if (ch === "$") {
      const isDouble = input[i + 1] === "$";
      const open = isDouble ? i + 2 : i + 1;
      const close = isDouble
        ? input.indexOf("$$", open)
        : indexOfUnescapedDollar(input, open);
      if (close !== -1) {
        const value = input.slice(open, close);
        const closer = isDouble ? 2 : 1;
        if (
          isDouble
            ? value.trim().length > 0
            : isInlineMath(value, input[close + closer])
        ) {
          flushText(i);
          out.push({ type: "math", value });
          i = close + (isDouble ? 2 : 1);
          textStart = i;
          continue;
        }
      }
    }
    // Link [text](href) — after code so a code span still wins; the label is plain text, and malformed forms fall through as literal text.
    if (ch === "[") {
      const closeBracket = input.indexOf("]", i + 1);
      if (closeBracket !== -1 && input[closeBracket + 1] === "(") {
        const closeParen = input.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          const label = input.slice(i + 1, closeBracket);
          const href = input.slice(closeBracket + 2, closeParen).trim();
          if (label.length > 0 && href.length > 0) {
            flushText(i);
            out.push({ type: "link", value: label, href });
            i = closeParen + 1;
            textStart = i;
            continue;
          }
        }
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
  return mergeText(out);
}
