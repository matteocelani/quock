// Stub for `react-native-pdf-page-image` — rendering a PDF page is a native op that can't execute under Jest. Real
// rendering is checked by hand on device (see e2e/README.md); this keeps the import resolvable and the call spy-able.

export interface PageImage {
  uri: string;
  width: number;
  height: number;
}
export interface PdfInfo {
  uri: string;
  pageCount: number;
}

// Default export mirrors the real package's shape (a class of statics), signatures included, so a test can assert WHICH
// page index the caller asked for. A render returns zero-sized pages: reachable, but never assertable on page bytes.
export default class PdfPageImage {
  static async open(uri: string): Promise<PdfInfo> {
    return { uri, pageCount: 0 };
  }
  static async generate(
    uri: string,
    page: number,
    scale?: number,
  ): Promise<PageImage> {
    return { uri: `${uri}#${page}@${scale ?? 1}`, width: 0, height: 0 };
  }
  static async close(_uri: string): Promise<void> {}
}
