// A scanned PDF has no text to extract — the characters are pixels. OCR reads them back out on-device (Apple Vision on
// iOS, ML Kit on Android), which is what lets a model WITHOUT vision read a scan at all.

import { Platform } from "react-native";
import { extractTextFromImage, isSupported } from "expo-text-extractor";
import type { PdfPageText, RenderedPage } from "@/modules/chat/lib/pdfDocument";

// Android resolves the argument with `File(path)`, which never matches a `file://` string, so every page failed there
// with "file not found" and the scan came back empty. iOS needs the scheme kept.
function nativePath(uri: string): string {
  return Platform.OS === "android" ? uri.replace(/^file:\/\//, "") : uri;
}

// Recognised lines come back separately; joined with newlines they keep the layout a table or a form relies on.
export function joinRecognisedLines(lines: readonly string[]): string {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

// Reads the rendered pages back as text. A page that recognises nothing is dropped rather than sent as an empty block,
// and one that throws costs only itself: half a document beats none, and the caller still has the images for vision.
export async function ocrPages(
  sources: readonly RenderedPage[],
): Promise<PdfPageText[]> {
  if (!isSupported || sources.length === 0) return [];
  const pages: PdfPageText[] = [];
  for (const source of sources) {
    try {
      const text = joinRecognisedLines(
        await extractTextFromImage(nativePath(source.uri)),
      );
      if (text.length > 0) {
        pages.push({ page: source.page, text, isFromOcr: true });
      }
    } catch (err) {
      console.warn(`pdfOcr: page ${source.page} did not recognise`, err);
    }
  }
  return pages;
}
