// A PDF is HYBRID: its text layer folds into the message so EVERY model gets the exact characters, and for vision
// models its first pages ALSO render to images (tables/layout the text linearisation loses). Both run at send time.

import PdfPageImage from "react-native-pdf-page-image";
import { extractText } from "expo-pdf-text-extract";
import { downscaleImageUri, readUriAsBytes } from "@/modules/chat/lib/imageUpload";
import { PDF_PAGE_IMAGE_LIMIT, PDF_PAGE_RENDER_SCALE } from "@/modules/chat/constants";
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
export async function renderPdfPageImages(
  uri: string,
  filename: string,
  sourceId: string,
): Promise<UiAttachment[]> {
  const info = await PdfPageImage.open(uri);
  const pageCount = Math.min(info.pageCount, PDF_PAGE_IMAGE_LIMIT);
  const images: UiAttachment[] = [];
  try {
    for (let page = 1; page <= pageCount; page += 1) {
      // Render above 1x, then reuse the photo downscaler (2048px long edge, JPEG) so small digits stay crisp.
      const rendered = await PdfPageImage.generate(uri, page, PDF_PAGE_RENDER_SCALE);
      // generate() already returns the scaled pixel size, so downscale against those dims as-is (no re-multiply).
      const scaledUri = await downscaleImageUri(
        rendered.uri,
        rendered.width,
        rendered.height,
      );
      const data = await readUriAsBytes(scaledUri);
      // Key the id off sourceId (unique per pick), never filename — two same-named PDFs must not collide.
      images.push({
        id: `pdfpage-${sourceId}-${page}`,
        filename: `${filename} (page ${page})`,
        uri: scaledUri,
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
