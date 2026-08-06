// The cloud `/api/chat` has no document slot (only content + images), so a text attachment is read as UTF-8 on-device
// and folded into the message. A PDF goes through a native extractor (pdfDocument); Office formats need their own.

import {
  DOCUMENT_BINARY_REPLACEMENT_RATIO,
  DOCUMENT_BINARY_SNIFF_CHARS,
  DOCUMENT_TEXT_MAX_CHARS,
  DOCUMENT_TEXT_TOTAL_MAX_CHARS,
} from "@/modules/chat/constants";

// Image attachments ride the vision `images[]` path, never the text fold.
export function isImageMime(mimeType: string | null | undefined): boolean {
  return mimeType?.startsWith("image/") === true;
}

// Non-`text/*` MIME types DocumentPicker still reports for inline-able text.
const TEXT_DOC_MIMES = new Set<string>([
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
  "application/toml",
  "application/javascript",
  "application/typescript",
] as const);
// Extension fallback: pickers often report a generic mime (octet-stream / public.data) for code files.
const TEXT_DOC_EXTENSIONS = new Set<string>([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "xml",
  "html",
  "htm",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "log",
  "rtf",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "cs",
  "go",
  "rs",
  "rb",
  "php",
  "swift",
  "kt",
  "scala",
  "sh",
  "bat",
  "sql",
] as const);

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 && dot < filename.length - 1
    ? filename.slice(dot + 1).toLowerCase()
    : "";
}

export function isTextDocument(
  mimeType: string | null | undefined,
  filename: string,
): boolean {
  if (isImageMime(mimeType)) return false;
  if (mimeType !== null && mimeType !== undefined) {
    if (mimeType.startsWith("text/")) return true;
    if (TEXT_DOC_MIMES.has(mimeType)) return true;
  }
  return TEXT_DOC_EXTENSIONS.has(extensionOf(filename));
}

export function decodeDocumentText(data: Uint8Array): string {
  return new TextDecoder("utf-8").decode(data);
}

// A decoded binary is dominated by U+FFFD replacement chars; refuse to inline that garbage.
function isLikelyBinary(text: string): boolean {
  const sample = text.slice(0, DOCUMENT_BINARY_SNIFF_CHARS);
  if (sample.length === 0) return false;
  let bad = 0;
  for (let i = 0; i < sample.length; i += 1) {
    if (sample.charCodeAt(i) === 0xfffd) bad += 1;
  }
  return bad / sample.length > DOCUMENT_BINARY_REPLACEMENT_RATIO;
}

export interface TextDocInput {
  filename: string;
  data: Uint8Array;
}

// Text already in hand: a decoded document, or a PDF's text layer, which arrives as a string from a native call.
export interface TextBlockInput {
  filename: string;
  text: string;
}

// Decodes byte documents and drops the ones that turn out to be binary, so they can share one fold with text that
// never was bytes.
export function textDocBlocks(docs: TextDocInput[]): TextBlockInput[] {
  return docs.flatMap((doc) => {
    const text = decodeDocumentText(doc.data);
    return isLikelyBinary(text) ? [] : [{ filename: doc.filename, text }];
  });
}

export interface BlockAllocation {
  groups: TextBlockInput[][];
  isTruncated: boolean;
}

// Allocates the character budget across the conversation NEWEST FIRST, so the document just attached arrives whole and
// an older one yields. Groups come in and go out in chronological order.
export function allocateBlocks(
  groups: readonly (readonly TextBlockInput[])[],
): BlockAllocation {
  const out: TextBlockInput[][] = groups.map(() => []);
  let remaining = DOCUMENT_TEXT_TOTAL_MAX_CHARS;
  let isTruncated = false;
  for (let g = groups.length - 1; g >= 0; g -= 1) {
    const kept: TextBlockInput[] = [];
    let omitted = 0;
    for (const block of groups[g]) {
      const budget = Math.min(DOCUMENT_TEXT_MAX_CHARS, remaining);
      const text = block.text.slice(0, budget);
      if (text.length < block.text.length) isTruncated = true;
      if (text.length === 0) {
        if (block.text.length > 0) omitted += 1;
        continue;
      }
      remaining -= text.length;
      // A cut has to be visible to the model: asked for a value that fell past the cut, it would otherwise answer from
      // a document it believes it read whole. Worse on a table, where the rows simply stop.
      const marked =
        text.length < block.text.length
          ? `${text}\n[... cut here: ${text.length} of ${block.text.length} characters sent ...]`
          : text;
      kept.push({ filename: block.filename, text: marked });
    }
    // One note per turn rather than per block: a spent budget usually drops a whole document, not a stray page.
    if (omitted > 0) {
      kept.push({
        filename: `${omitted} document part${omitted > 1 ? "s" : ""}`,
        text: "[... omitted: the character budget went to more recent messages ...]",
      });
    }
    out[g] = kept;
  }
  return { groups: out, isTruncated };
}

// Frames already-allocated blocks onto a message's text. Capping lives in allocateBlocks, so this never drops anything.
export function foldBlocks(
  baseText: string,
  blocks: readonly TextBlockInput[],
): string {
  if (blocks.length === 0) return baseText;
  const framed = blocks.map((b) => `\n\n--- ${b.filename} ---\n${b.text}`);
  return baseText + framed.join("");
}
