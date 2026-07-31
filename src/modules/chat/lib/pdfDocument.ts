// A PDF is HYBRID: its text layer folds into the message so EVERY model gets the exact characters, and for vision
// models its first pages ALSO render to images (tables/layout the text linearisation loses). Both run at send time.

import PdfPageImage from "react-native-pdf-page-image";
import { extractText } from "expo-pdf-text-extract";
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

// Extract the PDF's text layer on-device (native PDFKit / PDFBox). Returns "" on a text-less scan or any failure —
// the caller still has the page images (vision) as fallback, so a miss never blocks the send.
export async function extractPdfText(uri: string): Promise<string> {
  try {
    return await extractText(uri);
  } catch (err) {
    console.warn("pdfDocument: text extraction failed", err);
    return "";
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
  const info = await PdfPageImage.open(uri);
  const pageCount = Math.min(info.pageCount, PDF_PAGE_IMAGE_LIMIT);
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
  } finally {
    // Always free the native document + its temp files, even if a page render throws mid-loop.
    await PdfPageImage.close(uri);
  }
  return images;
}
