// Stub for `expo-pdf-text-extract` — text extraction runs on native PDFKit / PDFBox, which Jest cannot load. Stubs only
// what the app imports, as the expo-image-manipulator shim does; the real extraction is exercised on device.

export function getPageCount(): Promise<number> {
  return Promise.resolve(0);
}

export function extractTextFromPage(): Promise<string> {
  return Promise.resolve("");
}
