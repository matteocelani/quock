import {
  isPdf,
  mergeOcrPages,
  pagesToRender,
  pdfPlaceholder,
  pdfPageBlocks,
  type PdfTextResult,
} from "@/modules/chat/lib/pdfDocument";
import { PDF_TEXT_THIN_CHARS_PER_PAGE } from "@/modules/chat/constants";

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
