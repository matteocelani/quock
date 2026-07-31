// A document's text has to outlive the turn it was attached in: every later turn replays the conversation, so the text
// is rebuilt from the persisted row. A PDF keeps its extraction (a native pass per turn would be wasteful, and the
// picker URI may already be reclaimed); a text file is re-decoded from the bytes it already stores.

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

// The whole extraction result is stored, not just the text: the page numbers and the reason a document read as empty are
// both part of what the model was told, so a replay has to be able to say the same thing.
export function serializePdfText(result: PdfTextResult): string {
  return JSON.stringify(result);
}

// Malformed stored text costs the document, never the send: an old or half-written row must not throw mid-turn.
function parsePdfText(raw: string): PdfTextResult | null {
  try {
    const parsed = JSON.parse(raw) as PdfTextResult;
    if (!Array.isArray(parsed.pages) || typeof parsed.pageCount !== "number") {
      return null;
    }
    return {
      pageCount: parsed.pageCount,
      pages: parsed.pages.filter(
        (p) => typeof p.page === "number" && typeof p.text === "string",
      ),
      ...(parsed.failure !== undefined ? { failure: parsed.failure } : {}),
    };
  } catch (err) {
    console.warn("attachmentText: stored PDF text is not readable", err);
    return null;
  }
}

// The blocks one persisted attachment contributes, identical whether this is its own turn or a replay of it.
// `hasVision` is read live rather than stored, so moving the chat to a model that cannot see images starts saying so.
export function attachmentTextBlocks(
  row: DbAttachment,
  hasVision: boolean,
): TextBlockInput[] {
  if (row.textContent !== null) {
    const result = parsePdfText(row.textContent);
    if (result === null) return [];
    const blocks = pdfPageBlocks(row.filename, result.pages);
    const note = pdfPlaceholder(row.filename, result, hasVision);
    return note === null
      ? blocks
      : [...blocks, { filename: row.filename, text: note }];
  }
  if (isTextDocument(row.mimeType, row.filename)) {
    return textDocBlocks([{ filename: row.filename, data: row.data }]);
  }
  return [];
}
