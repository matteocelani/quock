// The cloud `/api/chat` has no document slot (only content + images), so text/code attachments are read as
// UTF-8 on-device and folded into the message content. Binary docs (pdf/docx) can't be decoded — they need a parser.

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

// Folds each document's decoded text onto the user's typed message, capped per-file and in total so a
// huge file can't blow the model context. Returns baseText unchanged when there is nothing to add.
export function appendDocumentText(
  baseText: string,
  docs: TextDocInput[],
): string {
  if (docs.length === 0) return baseText;
  const blocks: string[] = [];
  let total = 0;
  for (const doc of docs) {
    if (total >= DOCUMENT_TEXT_TOTAL_MAX_CHARS) break;
    const decoded = decodeDocumentText(doc.data);
    if (isLikelyBinary(decoded)) continue;
    const budget = Math.min(
      DOCUMENT_TEXT_MAX_CHARS,
      DOCUMENT_TEXT_TOTAL_MAX_CHARS - total,
    );
    const text = decoded.slice(0, budget);
    if (text.length === 0) continue;
    total += text.length;
    blocks.push(`\n\n--- ${doc.filename} ---\n${text}`);
  }
  return blocks.length > 0 ? baseText + blocks.join("") : baseText;
}
