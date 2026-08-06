// A document's text has to outlive its own turn, so every later turn rebuilds it from the persisted row: a PDF keeps its
// extraction (re-reading costs a native pass and a URI iOS may have reclaimed), a text file re-decodes from its bytes.

import type { DbAttachment } from "@/lib/db/types";
import {
  isTextDocument,
  textDocBlocks,
  type TextBlockInput,
} from "@/modules/chat/lib/documentText";
import {
  pdfPageBlocks,
  pdfPlaceholder,
  type PdfTextResult,
} from "@/modules/chat/lib/pdfDocument";

// The whole result is stored, not just the text: the page numbers and the reason a document read as empty are both part
// of what the model was told, so a replay can say the same thing.
export function serializePdfText(result: PdfTextResult): string {
  return JSON.stringify(result);
}

// Malformed stored text costs the document, never the send: an old or half-written row must not throw mid-turn.
function parsePdfText(raw: string): PdfTextResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("attachmentText: stored PDF text is not readable", err);
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { pages, pageCount, failure, fromOcr } = parsed as Record<
    string,
    unknown
  >;
  if (!Array.isArray(pages)) return null;
  if (typeof pageCount !== "number" || !Number.isInteger(pageCount)) return null;
  return {
    pageCount: Math.max(0, pageCount),
    pages: pages.filter(
      (p): p is { page: number; text: string } =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { page?: unknown }).page === "number" &&
        typeof (p as { text?: unknown }).text === "string",
    ),
    ...(failure === "password" || failure === "unreadable" ? { failure } : {}),
    ...(fromOcr === true ? { fromOcr: true } : {}),
  };
}

// The blocks one attachment contributes, identical on its own turn and on a replay. `hasPages` is whether pages were
// rendered for it at send time, which is what decides whether its emptiness needs explaining.
export function attachmentTextBlocks(
  row: DbAttachment,
  hasPages: boolean,
): TextBlockInput[] {
  if (row.textContent !== null) {
    const result = parsePdfText(row.textContent);
    if (result === null) return [];
    const blocks = pdfPageBlocks(
      row.filename,
      result.pages,
      result.fromOcr === true,
    );
    const note = pdfPlaceholder(row.filename, result, hasPages);
    return note === null
      ? blocks
      : [...blocks, { filename: row.filename, text: note }];
  }
  if (isTextDocument(row.mimeType, row.filename)) {
    return textDocBlocks([{ filename: row.filename, data: row.data }]);
  }
  return [];
}
