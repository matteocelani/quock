import PdfPageImage from "react-native-pdf-page-image";
import { extractTextFromPage, getPageCount } from "expo-pdf-text-extract";
import {
  extractPdfText,
  isPdf,
  mergeOcrPages,
  pagesToRender,
  pdfPlaceholder,
  pdfPageBlocks,
  renderPdfPages,
  type PdfTextResult,
} from "@/modules/chat/lib/pdfDocument";
import {
  PDF_PAGE_RENDER_SCALE,
  PDF_TEXT_THIN_CHARS_PER_PAGE,
} from "@/modules/chat/constants";

// The root `__mocks__` shims are plain stubs, so the extractor is re-mocked here as spies: what these tests assert is
// WHICH page the native call was asked for, which is where a silent off-by-one lives.
jest.mock("expo-pdf-text-extract", () => ({
  getPageCount: jest.fn(),
  extractTextFromPage: jest.fn(),
}));
const mockPageCount = getPageCount as jest.MockedFunction<typeof getPageCount>;
const mockPageText = extractTextFromPage as jest.MockedFunction<
  typeof extractTextFromPage
>;

// A digital page carries far more than the threshold; a scanned one carries nothing.
const RICH = "x".repeat(PDF_TEXT_THIN_CHARS_PER_PAGE * 10);
const digital: PdfTextResult = {
  pageCount: 3,
  pages: [
    { page: 1, text: RICH },
    { page: 3, text: RICH },
  ],
};
const scan: PdfTextResult = { pageCount: 11, pages: [] };

describe("isPdf", () => {
  it("accepts the mime or the extension, since pickers report octet-stream", () => {
    expect(isPdf("application/pdf", "anything")).toBe(true);
    expect(isPdf("application/octet-stream", "invoices.PDF")).toBe(true);
    expect(isPdf("image/png", "photo.png")).toBe(false);
  });
});

describe("pdfPageBlocks", () => {
  it("labels every block with the file and the page it came from", () => {
    expect(
      pdfPageBlocks("invoices.pdf", digital.pages).map((b) => b.filename),
    ).toEqual(["invoices.pdf, page 1", "invoices.pdf, page 3"]);
  });

  it("emits nothing for a document with no text layer", () => {
    expect(pdfPageBlocks("scan.pdf", scan.pages)).toEqual([]);
  });
});

describe("mergeOcrPages", () => {
  // The bug this exists for: a hybrid document (mostly scans, a few real text pages) had its whole extraction
  // overwritten by the OCR of the first 30 pages, so every text page the extractor had already read was thrown away.
  it("keeps the pages the extractor read and adds the recognised ones", () => {
    const merged = mergeOcrPages(
      { pageCount: 40, pages: [{ page: 40, text: "signed" }] },
      [{ page: 1, text: "recognised", isFromOcr: true }],
    );
    expect(merged.pages).toEqual([
      { page: 1, text: "recognised", isFromOcr: true },
      { page: 40, text: "signed" },
    ]);
    expect(merged.pageCount).toBe(40);
  });

  it("lets OCR win the page it read, since a scan's own layer has nothing to lose", () => {
    const merged = mergeOcrPages(
      { pageCount: 1, pages: [{ page: 1, text: "fig. 1" }] },
      [{ page: 1, text: "the whole invoice", isFromOcr: true }],
    );
    expect(merged.pages).toEqual([
      { page: 1, text: "the whole invoice", isFromOcr: true },
    ]);
  });

  it("carries the failure through, so a locked document stays locked", () => {
    const merged = mergeOcrPages({ ...scan, failure: "password" }, []);
    expect(merged.failure).toBe("password");
  });
});

describe("extractPdfText", () => {
  beforeEach(() => {
    mockPageCount.mockReset();
    mockPageText.mockReset();
  });

  it("carries the page number with the text, so an answer can cite it", async () => {
    mockPageCount.mockResolvedValue(2);
    mockPageText.mockImplementation((_uri: string, page: number) =>
      Promise.resolve(`page ${page} text`),
    );
    const result = await extractPdfText("file:///doc.pdf");
    expect(mockPageText.mock.calls.map((c) => c[1])).toEqual([1, 2]);
    expect(result).toEqual({
      pageCount: 2,
      pages: [
        { page: 1, text: "page 1 text" },
        { page: 2, text: "page 2 text" },
      ],
    });
  });

  // One unreadable page must not cost the others, while a password stops the whole document — the two are told apart by
  // the extractor's error code, and only the second one has a toast to fire.
  it("keeps the pages that did extract when one throws", async () => {
    mockPageCount.mockResolvedValue(3);
    mockPageText.mockImplementation((_uri: string, page: number) =>
      page === 2
        ? Promise.reject(new Error("bad page"))
        : Promise.resolve(`p${page}`),
    );
    const result = await extractPdfText("file:///doc.pdf");
    expect(result.pages.map((p) => p.page)).toEqual([1, 3]);
    expect(result.failure).toBeUndefined();
  });

  it("stops the whole document on a password, and names the reason", async () => {
    mockPageCount.mockResolvedValue(3);
    mockPageText.mockRejectedValue(
      Object.assign(new Error("locked"), { code: "PASSWORD_REQUIRED" }),
    );
    const result = await extractPdfText("file:///doc.pdf");
    expect(result).toEqual({ pageCount: 3, pages: [], failure: "password" });
  });

  it("blames the file, not the password, when the count cannot be read", async () => {
    mockPageCount.mockRejectedValue(new Error("not a pdf"));
    const result = await extractPdfText("file:///doc.pdf");
    expect(result).toEqual({ pageCount: 0, pages: [], failure: "unreadable" });
  });

  it("skips a page whose text is only whitespace", async () => {
    mockPageCount.mockResolvedValue(2);
    mockPageText.mockImplementation((_uri: string, page: number) =>
      Promise.resolve(page === 1 ? "   \n " : "real"),
    );
    const result = await extractPdfText("file:///doc.pdf");
    expect(result.pages).toEqual([{ page: 2, text: "real" }]);
  });
});

describe("renderPdfPages", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The module counts pages from zero while the rest of the app counts from one. Asking for the page number directly
  // rendered the NEXT page and threw on the last, which shipped once as a document that silently lost page 1.
  it("asks the native module for the zero-based index of every page", async () => {
    const generate = jest.spyOn(PdfPageImage, "generate");
    const rendered = await renderPdfPages("file:///doc.pdf", [1, 2, 11]);
    expect(generate.mock.calls.map((c) => c[1])).toEqual([0, 1, 10]);
    expect(rendered.pages.map((p) => p.page)).toEqual([1, 2, 11]);
    expect(rendered.isCutShort).toBe(false);
    // The scale has to reach the native call: the patched renderer is what turns it into real resolution, and a page
    // rendered at 1x reaches the model too soft for OCR to read a digit.
    expect(generate.mock.calls.map((c) => c[2])).toEqual([
      PDF_PAGE_RENDER_SCALE,
      PDF_PAGE_RENDER_SCALE,
      PDF_PAGE_RENDER_SCALE,
    ]);
  });

  it("keeps what rendered and flags the cut when a page throws", async () => {
    jest
      .spyOn(PdfPageImage, "generate")
      .mockImplementation((uri: string, page: number) =>
        page === 1
          ? Promise.reject(new Error("render failed"))
          : Promise.resolve({ uri, width: 10, height: 20 }),
      );
    const rendered = await renderPdfPages("file:///doc.pdf", [1, 2, 3]);
    expect(rendered.pages.map((p) => p.page)).toEqual([1]);
    expect(rendered.isCutShort).toBe(true);
  });

  it("flags the cut when the document will not open at all", async () => {
    jest.spyOn(PdfPageImage, "open").mockRejectedValue(new Error("locked"));
    const rendered = await renderPdfPages("file:///doc.pdf", [1]);
    expect(rendered).toEqual({ pages: [], isCutShort: true });
  });

  it("renders nothing, and opens nothing, for an empty page list", async () => {
    const open = jest.spyOn(PdfPageImage, "open");
    const rendered = await renderPdfPages("file:///doc.pdf", []);
    expect(rendered).toEqual({ pages: [], isCutShort: false });
    expect(open).not.toHaveBeenCalled();
  });
});

describe("pagesToRender", () => {
  // The whole point of dropping the fixed page cap: a text-rich document costs zero renders.
  it("renders nothing when the text layer already carries the document", () => {
    expect(pagesToRender(digital)).toEqual([]);
  });

  it("renders every page when the pages are pictures", () => {
    expect(pagesToRender(scan)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("treats a page with a caption's worth of text as a picture", () => {
    expect(
      pagesToRender({ pageCount: 1, pages: [{ page: 1, text: "fig. 1" }] }),
    ).toEqual([1]);
  });
});

describe("pdfPlaceholder", () => {
  it("names a locked PDF so the model cannot mistake it for an empty one", () => {
    expect(
      pdfPlaceholder("locked.pdf", { ...scan, failure: "password" }, true),
    ).toContain("password protected");
  });

  it("tells a model without vision that the pages were images", () => {
    expect(pdfPlaceholder("scan.pdf", scan, false)).toContain("11 pages");
  });

  it("stays silent when the pages will ride as images", () => {
    expect(pdfPlaceholder("scan.pdf", scan, true)).toBeNull();
  });

  it("stays silent for a document that read as text", () => {
    expect(pdfPlaceholder("invoices.pdf", digital, false)).toBeNull();
  });
});
