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
  type PdfPageText,
  type PdfTextResult,
} from "@/modules/chat/lib/pdfDocument";

// The whole result is stored, not just the text: the page numbers and the reason a document read as empty are both part
// of what the model was told, so a replay can say the same thing.
export function serializePdfText(result: PdfTextResult): string {
  return JSON.stringify(result);
}

// One stored page, or nothing: a malformed entry costs its own page instead of the whole document. The document-level
// flag is honoured for rows written before it moved per page, so a scan read yesterday still says its text was recognised.
function toPageText(
  raw: unknown,
  isDocumentFromOcr: boolean,
): PdfPageText | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { page, text, isFromOcr } = raw as Record<string, unknown>;
  if (typeof page !== "number" || typeof text !== "string") return null;
  return isFromOcr === true || isDocumentFromOcr
    ? { page, text, isFromOcr: true }
    : { page, text };
}

// Malformed stored text costs the document, never the send: an old or half-written row must not throw mid-turn. Named in
// the log because a document dropped from a turn is otherwise indistinguishable from one the model chose to ignore.
function parsePdfText(raw: string, filename: string): PdfTextResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`attachmentText: ${filename} has unreadable stored text`, err);
    return null;
  }
  const { pages, pageCount, failure, fromOcr } = (parsed ?? {}) as Record<
    string,
    unknown
  >;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray(pages) ||
    typeof pageCount !== "number" ||
    !Number.isInteger(pageCount)
  ) {
    console.warn(
      `attachmentText: ${filename} has stored text of an unexpected shape`,
    );
    return null;
  }
  return {
    pageCount: Math.max(0, pageCount),
    pages: pages.flatMap((p) => toPageText(p, fromOcr === true) ?? []),
    ...(failure === "password" || failure === "unreadable" ? { failure } : {}),
  };
}

// The blocks one attachment contributes, identical on its own turn and on a replay. `hasPages` is whether pages were
// rendered for it at send time, which is what decides whether its emptiness needs explaining.
export function attachmentTextBlocks(
  row: DbAttachment,
  hasPages: boolean,
): TextBlockInput[] {
  if (row.textContent !== null) {
    const result = parsePdfText(row.textContent, row.filename);
    // Returning nothing would let the model answer about a document it never received. Said out loud instead, which is
    // the same contract as a document that could not be read in the first place.
    if (result === null) {
      return [
        {
          filename: row.filename,
          text: `[${row.filename} — its stored text could not be read back]`,
        },
      ];
    }
    const blocks = pdfPageBlocks(row.filename, result.pages);
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
