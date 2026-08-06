// A PDF is HYBRID: its text layer folds into the message so EVERY model gets the exact characters, and a document whose
// pages ARE pictures also renders to images for vision models. Both run at send time.

import PdfPageImage from "react-native-pdf-page-image";
import { extractTextFromPage, getPageCount } from "expo-pdf-text-extract";
import {
  deleteFileQuietly,
  readUriAsBytes,
  toJpegUri,
} from "@/modules/chat/lib/imageUpload";
import {
  PDF_PAGE_RENDER_SCALE,
  PDF_TEXT_THIN_CHARS_PER_PAGE,
} from "@/modules/chat/constants";
import type { TextBlockInput } from "@/modules/chat/lib/documentText";

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
export type PdfFailure = "password" | "unreadable";

export interface PdfPageText {
  page: number;
  text: string;
  // Set when THIS page's characters were recognised from its pixels rather than read from the file's own text layer. Per
  // page, because a hybrid document mixes the two and OCR — which misreads a digit now and then — should not taint both.
  isFromOcr?: boolean;
}
export interface PdfTextResult {
  // Only pages that carry text, so a blank page costs nothing downstream.
  pages: PdfPageText[];
  pageCount: number;
  failure?: PdfFailure;
}

// The extractor throws with a `.code` for the cases it can name; everything else is just a broken file.
function classifyFailure(err: unknown): PdfFailure {
  if (typeof err !== "object" || err === null || !("code" in err)) {
    return "unreadable";
  }
  const code = (err as { code?: unknown }).code;
  return code === "PASSWORD_REQUIRED" || code === "INCORRECT_PASSWORD"
    ? "password"
    : "unreadable";
}

// Page by page rather than in one call so the page number travels with the text: the model can then say WHERE it read a
// value. No page cap — a document contributes all of itself, as the Ollama desktop client's extractor also does.
export async function extractPdfText(uri: string): Promise<PdfTextResult> {
  let pageCount = 0;
  try {
    pageCount = await getPageCount(uri);
  } catch (err) {
    console.warn("pdfDocument: cannot read the page count", err);
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

// One block per page, labelled with the file AND the page, so an answer can cite the page. Takes pages rather than a
// result because a replayed turn rebuilds the same blocks from the stored pages, not from a fresh extraction.
export function pdfPageBlocks(
  filename: string,
  pages: readonly PdfPageText[],
): TextBlockInput[] {
  return pages.map((p) => ({
    filename: `${filename}, page ${p.page}${
      p.isFromOcr === true ? " (text recognised from the scan)" : ""
    }`,
    text: p.text,
  }));
}

// OCR wins per page (a scan's own layer has nothing to lose) while every page the extractor already read survives: a
// hybrid document must keep its real text pages, and so must the pages past the OCR cap.
export function mergeOcrPages(
  result: PdfTextResult,
  recognised: readonly PdfPageText[],
): PdfTextResult {
  const byPage = new Map<number, PdfPageText>();
  for (const p of result.pages) byPage.set(p.page, p);
  for (const p of recognised) byPage.set(p.page, p);
  return {
    ...result,
    pages: [...byPage.values()].sort((a, b) => a.page - b.page),
  };
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

// What the model is told when a PDF contributed nothing; silence reads as an ignored attachment. `hasPages` is whether
// pages were persisted for it — asking whether THIS model has vision goes quiet the moment the chat moves to one.
export function pdfPlaceholder(
  filename: string,
  result: PdfTextResult,
  hasPages: boolean,
): string | null {
  if (result.failure === "password") {
    return `[${filename} — password protected, could not be read]`;
  }
  if (result.failure === "unreadable") {
    return `[${filename} — could not be read]`;
  }
  if (result.pages.length === 0 && !hasPages) {
    return `[${filename} — ${result.pageCount} pages with no text layer; this model cannot read images]`;
  }
  return null;
}

// Rendering and closing are separate on purpose: closing deletes the rendered files, and OCR has to read them first.
// The caller owns the pair — render, use, close — because only it knows whether the pixels are also wanted for vision.
export interface RenderedPage {
  page: number;
  uri: string;
  width: number;
  height: number;
}

export interface RenderedPages {
  pages: RenderedPage[];
  // Set when fewer pages came back than were asked for, so the caller can say so instead of shipping a silent gap.
  isCutShort: boolean;
}

export async function renderPdfPages(
  uri: string,
  pages: readonly number[],
): Promise<RenderedPages> {
  if (pages.length === 0) return { pages: [], isCutShort: false };
  // Degrade like the text side does: a PDF that cannot be opened costs the pages, never the send.
  try {
    await PdfPageImage.open(uri);
  } catch (err) {
    console.warn("pdfDocument: cannot open the PDF for rendering", err);
    return { pages: [], isCutShort: true };
  }
  const out: RenderedPage[] = [];
  let isCutShort = false;
  try {
    for (const page of pages) {
      // The module indexes pages from zero (PDFKit `page(at:)`, Android `openPage`) while everything here counts from one:
      // asking for `page` directly renders the NEXT one, throws on the last, and silently drops page 1.
      const rendered = await PdfPageImage.generate(
        uri,
        page - 1,
        PDF_PAGE_RENDER_SCALE,
      );
      out.push({
        page,
        uri: rendered.uri,
        width: rendered.width,
        height: rendered.height,
      });
    }
  } catch (err) {
    // Keep the pages that did render: a document that stops early still gives the model something.
    console.warn("pdfDocument: page render stopped early", err);
    isCutShort = true;
  }
  return { pages: out, isCutShort };
}

// Frees the native document and deletes the files it rendered.
export async function closePdfRender(uri: string): Promise<void> {
  await PdfPageImage.close(uri).catch((err: unknown) => {
    console.warn("pdfDocument: closing the PDF failed", err);
  });
}

// Deliberately not a `UiAttachment`: the JPEG behind a derived page is deleted as soon as its bytes are read, so a shape
// carrying a `uri` would advertise a path to a file that no longer exists. The row keeps the bytes; nothing shows a page.
export interface RenderedPageAttachment {
  filename: string;
  mimeType: string;
  data: Uint8Array;
  sizeBytes: number;
}

// Turns one rendered page into a wire attachment: JPEG for the size (a PNG page is ten times bigger and every turn
// re-uploads it) and bytes because that is what the row stores. Only worth doing for a model that can see images.
export async function pageToAttachment(
  rendered: RenderedPage,
  filename: string,
): Promise<RenderedPageAttachment | null> {
  try {
    const jpegUri = await toJpegUri(
      rendered.uri,
      rendered.width,
      rendered.height,
    );
    const data = await readUriAsBytes(jpegUri);
    // The JPEG is a means, not a keepsake: the row carries the bytes, so leaving the file behind would only fill the cache.
    await deleteFileQuietly(jpegUri);
    return {
      filename: `${filename} (page ${rendered.page})`,
      mimeType: "image/jpeg",
      data,
      sizeBytes: data.byteLength,
    };
  } catch (err) {
    console.warn(`pdfDocument: page ${rendered.page} did not convert`, err);
    return null;
  }
}
