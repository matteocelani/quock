// Stub for `expo-text-extractor` — OCR runs on Apple Vision / ML Kit, which Jest cannot load. Stubs only what the app
// imports; the recognition itself is exercised on device.

export const isSupported = false;

export function extractTextFromImage(): Promise<string[]> {
  return Promise.resolve([]);
}
