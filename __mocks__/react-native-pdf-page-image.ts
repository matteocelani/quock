// Stub for `react-native-pdf-page-image` — rendering a PDF page is a native op that can't execute under Jest.
// The PDF send path is covered by Maestro E2E on device, so this only keeps a transitive import resolvable.

export interface PageImage {
  uri: string;
  width: number;
  height: number;
}
export interface PdfInfo {
  uri: string;
  pageCount: number;
}

// Default export mirrors the real package's shape (a class of statics), which the import site depends on.
export default class PdfPageImage {
  // A zero page count makes the render loop a no-op, so a test never depends on fake page bytes.
  static async open(uri: string): Promise<PdfInfo> {
    return { uri, pageCount: 0 };
  }
  static async generate(uri: string): Promise<PageImage> {
    return { uri, width: 0, height: 0 };
  }
  static async close(): Promise<void> {}
}
