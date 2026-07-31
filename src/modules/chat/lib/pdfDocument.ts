// A PDF is HYBRID: its text layer folds into the message so EVERY model gets the exact characters, and for vision
// models its first pages ALSO render to images (tables/layout the text linearisation loses). Both run at send time.

import PdfPageImage from "react-native-pdf-page-image";
import { extractTextWithInfo } from "expo-pdf-text-extract";
import { readUriAsBytes, toJpegUri } from "@/modules/chat/lib/imageUpload";
import {
  PDF_PAGE_IMAGE_LIMIT,
  PDF_PAGE_RENDER_SCALE,
} from "@/modules/chat/constants";
import type { UiAttachment } from "@/modules/chat/types";

const PDF_MIME = "application/pdf";

// True for a picked PDF by MIME or extension — pickers sometimes report octet-stream for a .pdf.
export function isPdf(
  mimeType: string | null | undefined,
  filename: string,
): boolean {
  return mimeType === PDF_MIME || filename.toLowerCase().endsWith(".pdf");
}

// Why not just a string: no text has three causes the caller must tell apart. A scan simply has no text layer and the
// page images cover it; a locked PDF can never be read and the user has to hear that; anything else is a broken file.
export interface PdfTextResult {
  text: string;
  failure?: "password" | "unreadable";
}

// Extract the PDF's text layer on-device (native PDFKit / PDFBox) via the non-throwing variant, which reports a
// password wall as a flag instead of an exception. A miss never blocks the send — vision still has the page images.
export async function extractPdfText(uri: string): Promise<PdfTextResult> {
  try {
    const info = await extractTextWithInfo(uri);
    if (info.text.length > 0) return { text: info.text };
    if (info.passwordRequired === true)
      return { text: "", failure: "password" };
    // Successful read, no characters: a scanned PDF. Not a failure — there is nothing to extract by design.
    if (info.success) return { text: "" };
    console.warn("pdfDocument: extraction returned no text", info.error);
    return { text: "", failure: "unreadable" };
  } catch (err) {
    console.warn("pdfDocument: text extraction failed", err);
    return { text: "", failure: "unreadable" };
  }
}

// Render the first pages (capped at PDF_PAGE_IMAGE_LIMIT) to downscaled JPEG attachments that ride the existing
// vision images[] path. VISION ONLY — callers must skip this for non-vision models.
// `budgetBytes` is the turn's REMAINING attachment budget: these pages are built past validateAttachment, so nothing
// downstream would stop a fat PDF from inflating the request.
export async function renderPdfPageImages(
  uri: string,
  filename: string,
  sourceId: string,
  budgetBytes: number,
): Promise<UiAttachment[]> {
  // Degrade like the text side does: a PDF that cannot be opened costs the vision half, never the send.
  let pageCount = 0;
  try {
    const info = await PdfPageImage.open(uri);
    pageCount = Math.min(info.pageCount, PDF_PAGE_IMAGE_LIMIT);
  } catch (err) {
    console.warn("pdfDocument: cannot open the PDF for rendering", err);
    return [];
  }
  const images: UiAttachment[] = [];
  let usedBytes = 0;
  try {
    for (let page = 1; page <= pageCount; page += 1) {
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
          `pdfDocument: budget reached, sending ${page - 1} of ${pageCount} pages`,
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
