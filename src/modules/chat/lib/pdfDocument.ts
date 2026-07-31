// A PDF is HYBRID: its text layer folds into the message so EVERY model gets the exact characters, and a document whose
// pages ARE pictures also renders to images for vision models. Both run at send time.

import PdfPageImage from "react-native-pdf-page-image";
import { extractTextFromPage, getPageCount } from "expo-pdf-text-extract";
import { readUriAsBytes, toJpegUri } from "@/modules/chat/lib/imageUpload";
import {
  PDF_PAGE_RENDER_SCALE,
  PDF_TEXT_THIN_CHARS_PER_PAGE,
} from "@/modules/chat/constants";
import type { TextBlockInput } from "@/modules/chat/lib/documentText";
import type { UiAttachment } from "@/modules/chat/types";

const PDF_MIME = "application/pdf";

// True for a picked PDF by MIME or extension — pickers sometimes report octet-stream for a .pdf.
export function isPdf(
  mimeType: string | null | undefined,
  filename: string,
): boolean {
  return mimeType === PDF_MIME || filename.toLowerCase().endsWith(".pdf");
}

// Why not just a string: no text has three causes the caller must tell apart. A locked PDF can never be read and the
// user has to hear that; a document whose pages are pictures needs the vision half; anything else is a broken file.
export interface PdfPageText {
  page: number;
  text: string;
}
export interface PdfTextResult {
  // Only pages that carry text, so a blank page costs nothing downstream.
  pages: PdfPageText[];
  pageCount: number;
  failure?: "password" | "unreadable";
}

// The extractor throws with a `.code` for the cases it can name; everything else is just a broken file.
function classifyFailure(err: unknown): "password" | "unreadable" {
  const code = (err as { code?: string } | null)?.code;
  return code === "PASSWORD_REQUIRED" || code === "INCORRECT_PASSWORD"
    ? "password"
    : "unreadable";
}

// Extract the text layer page by page (native PDFKit / PDFBox). Page by page and not in one call because the page
// number travels with the text: the model can then say WHERE it read something, and the caller can see which pages
// carry nothing. No page cap — a document contributes all of itself, as the Ollama desktop client also does.
export async function extractPdfText(uri: string): Promise<PdfTextResult> {
  let pageCount = 0;
  try {
    pageCount = await getPageCount(uri);
  } catch (err) {
    return { pages: [], pageCount: 0, failure: classifyFailure(err) };
  }
  const pages: PdfPageText[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    try {
      const text = await extractTextFromPage(uri, page);
      if (text.trim().length > 0) pages.push({ page, text });
    } catch (err) {
      // A password stops the whole document; one unreadable page must not cost the others.
      if (classifyFailure(err) === "password") {
        return { pages: [], pageCount, failure: "password" };
      }
      console.warn(`pdfDocument: page ${page} did not extract`, err);
    }
  }
  return { pages, pageCount };
}

// One fold block per page, labelled with the file AND the page, so a reader of the prompt can cite the page.
export function pdfTextBlocks(
  filename: string,
  result: PdfTextResult,
): TextBlockInput[] {
  return result.pages.map((p) => ({
    filename: `${filename}, page ${p.page}`,
    text: p.text,
  }));
}

// Whether the pages ARE pictures rather than pages carrying pictures. A digital document averages thousands of
// characters per page, so it needs no images at all; a scan averages none and the text layer cannot represent it.
function isTextThin(result: PdfTextResult): boolean {
  if (result.pageCount === 0) return true;
  const chars = result.pages.reduce((sum, p) => sum + p.text.trim().length, 0);
  return chars / result.pageCount < PDF_TEXT_THIN_CHARS_PER_PAGE;
}

// The pages the vision half has to carry, decided by what the text layer could not: none for a document that already
// reads as text (the common case, and the fast path), every page for one whose pages are pictures.
export function pagesToRender(result: PdfTextResult): number[] {
  if (!isTextThin(result)) return [];
  return Array.from({ length: result.pageCount }, (_, i) => i + 1);
}

// Says what the model should be told when a PDF contributed nothing. Silence reads as an ignored attachment, which is
// exactly the failure that makes a reader hunt for a value the model never received.
export function pdfPlaceholder(
  filename: string,
  result: PdfTextResult,
  hasVision: boolean,
): string | null {
  if (result.failure === "password") {
    return `[${filename} — password protected, could not be read]`;
  }
  if (result.failure === "unreadable") {
    return `[${filename} — could not be read]`;
  }
  if (result.pages.length === 0 && !hasVision) {
    return `[${filename} — ${result.pageCount} pages with no text layer; this model cannot read images]`;
  }
  return null;
}

// Render the given pages to JPEG attachments that ride the existing vision images[] path. VISION ONLY — callers must
// skip this for a model without it. There is no page-count limit: `budgetBytes`, the turn's REMAINING attachment
// budget, is the only ceiling, because these pages are built past validateAttachment and nothing else bounds them.
export async function renderPdfPageImages(
  uri: string,
  filename: string,
  sourceId: string,
  pages: readonly number[],
  budgetBytes: number,
): Promise<UiAttachment[]> {
  if (pages.length === 0) return [];
  // Degrade like the text side does: a PDF that cannot be opened costs the vision half, never the send.
  try {
    await PdfPageImage.open(uri);
  } catch (err) {
    console.warn("pdfDocument: cannot open the PDF for rendering", err);
    return [];
  }
  const images: UiAttachment[] = [];
  let usedBytes = 0;
  try {
    for (const page of pages) {
      // Render above 1x so small digits stay crisp, then re-encode: generate() writes PNG on both platforms, and these
      // ride the images[] path as image/jpeg — the label has to match the bytes the chip and the DB row will carry.
      const rendered = await PdfPageImage.generate(
        uri,
        page,
        PDF_PAGE_RENDER_SCALE,
      );
      // generate() already returns the scaled pixel size, so size against those dims as-is (no re-multiply).
      const jpegUri = await toJpegUri(
        rendered.uri,
        rendered.width,
        rendered.height,
      );
      const data = await readUriAsBytes(jpegUri);
      // Stop at the first page that would overflow rather than skipping it: dropping a middle page would leave the
      // model a document with a hole in it, which is worse than a document that plainly ends early.
      if (usedBytes + data.byteLength > budgetBytes) {
        console.warn(
          `pdfDocument: budget reached, sending ${images.length} of ${pages.length} pages`,
        );
        break;
      }
      usedBytes += data.byteLength;
      // Key the id off sourceId (unique per pick), never filename — two same-named PDFs must not collide.
      images.push({
        id: `pdfpage-${sourceId}-${page}`,
        filename: `${filename} (page ${page})`,
        uri: jpegUri,
        mimeType: "image/jpeg",
        data,
        sizeBytes: data.byteLength,
        status: "ready",
      });
    }
  } catch (err) {
    // Keep the pages that did render: a document that stops early still shows the model something.
    console.warn("pdfDocument: page render stopped early", err);
  } finally {
    // Always free the native document + its temp files, even if a page render threw mid-loop. A failed close only
    // leaks a temp file, so it must never discard the pages that already rendered.
    await PdfPageImage.close(uri).catch((err: unknown) => {
      console.warn("pdfDocument: closing the PDF failed", err);
    });
  }
  return images;
}
