// Stub for `expo-pdf-text-extract` — text extraction runs on native PDFKit / PDFBox, which Jest cannot load.
// Mirrors the package's named exports; the real extraction is covered by Maestro E2E on device.

export interface ExtractTextWithInfoResult {
  text: string;
  pageCount: number;
  success: boolean;
  isEncrypted: boolean;
  passwordRequired?: boolean;
  error?: string;
}

// Matches the real module's contract outside a dev client: no native module, so nothing is extractable.
export function isAvailable(): boolean {
  return false;
}

export async function extractText(): Promise<string> {
  return "";
}

export async function getPageCount(): Promise<number> {
  return 0;
}

export async function isPasswordProtected(): Promise<boolean> {
  return false;
}

export async function extractTextWithInfo(): Promise<ExtractTextWithInfoResult> {
  return {
    text: "",
    pageCount: 0,
    success: false,
    isEncrypted: false,
  };
}
