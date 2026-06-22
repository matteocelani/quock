// highlight.ts — Regex-based syntax tokenizer for the chat code block surface. Zero dependencies; covers a curated set of languages so assistant responses surface keywords/strings/comments without dragging in highlight.js / shiki.

export type SegmentKind =
  | "plain"
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "type"
  | "function"
  | "punctuation";

export interface HighlightedSegment {
  text: string;
  kind: SegmentKind;
}
// Per-language pattern bundle. `order` is implied: comments → strings → numbers → keywords → types → functions, so earlier matches win on overlap.
interface LangRule {
  pattern: RegExp;
  kind: SegmentKind;
}

interface LangDef {
  rules: LangRule[];
}
// Shared atoms — anchored at the scanner position so each call only inspects from `pos` onwards. Sticky flag (`y`) keeps the lastIndex semantics clean.
const NUMBER =
  /(?:0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
const FUNCTION_CALL = /[A-Za-z_$][A-Za-z0-9_$]*(?=\s*\()/y;
const JS_KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "new",
  "this",
  "class",
  "extends",
  "super",
  "import",
  "export",
  "from",
  "as",
  "typeof",
  "instanceof",
  "void",
  "null",
  "undefined",
  "true",
  "false",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "throw",
  "in",
  "of",
]);
const TS_EXTRA_KEYWORDS = new Set([
  "interface",
  "type",
  "enum",
  "public",
  "private",
  "protected",
  "readonly",
  "static",
  "abstract",
  "implements",
  "satisfies",
  "namespace",
  "declare",
]);
const PY_KEYWORDS = new Set([
  "def",
  "class",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "return",
  "import",
  "from",
  "as",
  "try",
  "except",
  "finally",
  "raise",
  "with",
  "pass",
  "break",
  "continue",
  "lambda",
  "yield",
  "global",
  "nonlocal",
  "in",
  "is",
  "not",
  "and",
  "or",
  "None",
  "True",
  "False",
  "self",
  "async",
  "await",
]);
const BASH_KEYWORDS = new Set([
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "for",
  "in",
  "do",
  "done",
  "while",
  "until",
  "case",
  "esac",
  "function",
  "return",
  "echo",
  "export",
  "source",
  "local",
  "readonly",
]);
const GO_KEYWORDS = new Set([
  "func",
  "package",
  "import",
  "var",
  "const",
  "type",
  "struct",
  "interface",
  "return",
  "if",
  "else",
  "for",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "go",
  "defer",
  "select",
  "chan",
  "map",
  "range",
  "nil",
  "true",
  "false",
]);
const JSON_KEYWORDS = new Set(["true", "false", "null"]);
// Build a keyword regex anchored to the current scanner position.
function buildIdentRule(keywords: Set<string>): RegExp {
  // Word-boundary on the trailing side prevents `inferred` from being lit when the keyword list contains `in`. Sticky anchors at `pos`.
  const alternation = Array.from(keywords)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(`(?:${alternation})\\b`, "y");
}

const JS_KEYWORD = buildIdentRule(JS_KEYWORDS);
const TS_KEYWORD = buildIdentRule(
  new Set([...JS_KEYWORDS, ...TS_EXTRA_KEYWORDS]),
);
const PY_KEYWORD = buildIdentRule(PY_KEYWORDS);
const BASH_KEYWORD = buildIdentRule(BASH_KEYWORDS);
const GO_KEYWORD = buildIdentRule(GO_KEYWORDS);
const JSON_KEYWORD = buildIdentRule(JSON_KEYWORDS);
const JS_LINE_COMMENT = /\/\/[^\n]*/y;
const JS_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//y;
const HASH_COMMENT = /#[^\n]*/y;
const DOUBLE_STRING = /"(?:\\.|[^"\\\n])*"/y;
const SINGLE_STRING = /'(?:\\.|[^'\\\n])*'/y;
const BACKTICK_STRING = /`(?:\\.|[^`\\])*`/y;
const PY_TRIPLE_DOUBLE = /"""[\s\S]*?"""/y;
const PY_TRIPLE_SINGLE = /'''[\s\S]*?'''/y;
// TS type position: identifier starting with uppercase preceded by `:`, `<`, `extends `, or `implements `. The lookbehind keeps the colon out of the match.
const TS_TYPE = /(?<=[:<,]\s*|\bextends\s+|\bimplements\s+)[A-Z][A-Za-z0-9_]*/y;
const LANGS: Record<string, LangDef> = {
  js: {
    rules: [
      { pattern: JS_LINE_COMMENT, kind: "comment" },
      { pattern: JS_BLOCK_COMMENT, kind: "comment" },
      { pattern: BACKTICK_STRING, kind: "string" },
      { pattern: DOUBLE_STRING, kind: "string" },
      { pattern: SINGLE_STRING, kind: "string" },
      { pattern: NUMBER, kind: "number" },
      { pattern: JS_KEYWORD, kind: "keyword" },
      { pattern: FUNCTION_CALL, kind: "function" },
    ],
  },
  ts: {
    rules: [
      { pattern: JS_LINE_COMMENT, kind: "comment" },
      { pattern: JS_BLOCK_COMMENT, kind: "comment" },
      { pattern: BACKTICK_STRING, kind: "string" },
      { pattern: DOUBLE_STRING, kind: "string" },
      { pattern: SINGLE_STRING, kind: "string" },
      { pattern: NUMBER, kind: "number" },
      { pattern: TS_KEYWORD, kind: "keyword" },
      { pattern: TS_TYPE, kind: "type" },
      { pattern: FUNCTION_CALL, kind: "function" },
    ],
  },
  python: {
    rules: [
      { pattern: HASH_COMMENT, kind: "comment" },
      { pattern: PY_TRIPLE_DOUBLE, kind: "string" },
      { pattern: PY_TRIPLE_SINGLE, kind: "string" },
      { pattern: DOUBLE_STRING, kind: "string" },
      { pattern: SINGLE_STRING, kind: "string" },
      { pattern: NUMBER, kind: "number" },
      { pattern: PY_KEYWORD, kind: "keyword" },
      { pattern: FUNCTION_CALL, kind: "function" },
    ],
  },
  json: {
    rules: [
      { pattern: DOUBLE_STRING, kind: "string" },
      { pattern: NUMBER, kind: "number" },
      { pattern: JSON_KEYWORD, kind: "keyword" },
    ],
  },
  bash: {
    rules: [
      { pattern: HASH_COMMENT, kind: "comment" },
      { pattern: DOUBLE_STRING, kind: "string" },
      { pattern: SINGLE_STRING, kind: "string" },
      { pattern: NUMBER, kind: "number" },
      { pattern: BASH_KEYWORD, kind: "keyword" },
    ],
  },
  go: {
    rules: [
      { pattern: JS_LINE_COMMENT, kind: "comment" },
      { pattern: JS_BLOCK_COMMENT, kind: "comment" },
      { pattern: BACKTICK_STRING, kind: "string" },
      { pattern: DOUBLE_STRING, kind: "string" },
      { pattern: SINGLE_STRING, kind: "string" },
      { pattern: NUMBER, kind: "number" },
      { pattern: GO_KEYWORD, kind: "keyword" },
      { pattern: FUNCTION_CALL, kind: "function" },
    ],
  },
};
// Alias table — the markdown parser passes raw fence labels; map them onto a canonical lang key.
const LANG_ALIASES: Record<string, keyof typeof LANGS> = {
  js: "js",
  javascript: "js",
  jsx: "js",
  ts: "ts",
  typescript: "ts",
  tsx: "ts",
  py: "python",
  python: "python",
  json: "json",
  sh: "bash",
  bash: "bash",
  shell: "bash",
  zsh: "bash",
  go: "go",
  golang: "go",
};

function resolveLang(lang: string): LangDef | null {
  const key = LANG_ALIASES[lang.toLowerCase()];
  if (key === undefined) return null;
  return LANGS[key];
}
// Try every rule at `pos`; return the first match. Sticky regexes mean their `lastIndex` lookup acts like an anchored test at that exact offset.
function tryMatch(
  source: string,
  pos: number,
  rules: LangRule[],
): { length: number; kind: SegmentKind } | null {
  for (const rule of rules) {
    rule.pattern.lastIndex = pos;
    const m = rule.pattern.exec(source);
    if (m !== null && m.index === pos && m[0].length > 0) {
      return { length: m[0].length, kind: rule.kind };
    }
  }
  return null;
}
// Coalesces adjacent same-kind segments so the renderer emits fewer <Text>s.
function pushSegment(
  out: HighlightedSegment[],
  text: string,
  kind: SegmentKind,
): void {
  if (text.length === 0) return;
  const last = out[out.length - 1];
  if (last !== undefined && last.kind === kind) {
    last.text += text;
    return;
  }
  out.push({ text, kind });
}

export function highlightCode(
  source: string,
  lang: string,
): HighlightedSegment[] {
  const def = resolveLang(lang);
  if (def === null) {
    if (source.length === 0) return [];
    return [{ text: source, kind: "plain" }];
  }

  const out: HighlightedSegment[] = [];
  let pos = 0;
  let plainStart = 0;
  while (pos < source.length) {
    const match = tryMatch(source, pos, def.rules);
    if (match === null) {
      pos += 1;
      continue;
    }
    if (pos > plainStart) {
      pushSegment(out, source.slice(plainStart, pos), "plain");
    }
    pushSegment(out, source.slice(pos, pos + match.length), match.kind);
    pos += match.length;
    plainStart = pos;
  }
  if (plainStart < source.length) {
    pushSegment(out, source.slice(plainStart), "plain");
  }
  return out;
}
