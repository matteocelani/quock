import {
  attachmentTextBlocks,
  serializePdfText,
} from "@/modules/chat/lib/attachmentText";
import type { PdfTextResult } from "@/modules/chat/lib/pdfDocument";
import type { DbAttachment } from "@/lib/db/types";
import { asAttachmentId, asMessageId } from "@/lib/types/ids";

function row(over: Partial<DbAttachment>): DbAttachment {
  return {
    id: asAttachmentId(1),
    messageId: asMessageId(1),
    filename: "invoices.pdf",
    mimeType: "application/pdf",
    data: new Uint8Array(),
    uri: null,
    sizeBytes: 0,
    textContent: null,
    derivedFrom: null,
    ...over,
  };
}

const extracted: PdfTextResult = {
  pageCount: 2,
  pages: [
    { page: 1, text: "cover" },
    { page: 2, text: "totals" },
  ],
};

describe("attachmentTextBlocks", () => {
  // The contract of the whole replay: a stored PDF rebuilds the blocks its own turn produced, page labels included.
  it("rebuilds page-labelled blocks from a stored extraction", () => {
    const blocks = attachmentTextBlocks(
      row({ textContent: serializePdfText(extracted) }),
      true,
    );
    expect(blocks).toEqual([
      { filename: "invoices.pdf, page 1", text: "cover" },
      { filename: "invoices.pdf, page 2", text: "totals" },
    ]);
  });

  it("keeps saying a stored PDF was locked", () => {
    const blocks = attachmentTextBlocks(
      row({
        textContent: serializePdfText({
          pageCount: 3,
          pages: [],
          failure: "password",
        }),
      }),
      true,
    );
    expect(blocks[0].text).toContain("password protected");
  });

  // hasVision is read live, not stored: moving the chat to a model that cannot see images has to start saying so.
  it("notes a text-less PDF only for a model without vision", () => {
    const stored = serializePdfText({ pageCount: 4, pages: [] });
    expect(attachmentTextBlocks(row({ textContent: stored }), true)).toEqual(
      [],
    );
    expect(
      attachmentTextBlocks(row({ textContent: stored }), false)[0].text,
    ).toContain("4 pages");
  });

  it("re-decodes a text document from its bytes instead of storing it twice", () => {
    const blocks = attachmentTextBlocks(
      row({
        filename: "notes.txt",
        mimeType: "text/plain",
        data: new TextEncoder().encode("hello"),
      }),
      false,
    );
    expect(blocks).toEqual([{ filename: "notes.txt", text: "hello" }]);
  });

  it("contributes nothing for an image", () => {
    expect(
      attachmentTextBlocks(
        row({ filename: "photo.jpg", mimeType: "image/jpeg" }),
        true,
      ),
    ).toEqual([]);
  });

  // Returning nothing would let the model answer about a document it never received, confidently and wrongly.
  it("says so when the stored text cannot be read back", () => {
    const blocks = attachmentTextBlocks(
      row({ textContent: "{not json" }),
      true,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toContain("could not be read back");
  });

  // The model is told the text was recognised rather than read, because OCR misreads a digit now and then.
  it("marks text that came from the scan, on the replay too", () => {
    const blocks = attachmentTextBlocks(
      row({
        filename: "scan.pdf",
        textContent: serializePdfText({
          pageCount: 1,
          pages: [{ page: 1, text: "SCAN-99417", isFromOcr: true }],
        }),
      }),
      true,
    );
    expect(blocks[0].filename).toBe("scan.pdf, page 1 (text recognised from the scan)");
    expect(blocks[0].text).toBe("SCAN-99417");
  });

  // The flag used to sit on the document. A device that OCR'd a scan under that build must keep saying so on replay.
  it("still reads the flag from rows written before it moved per page", () => {
    const blocks = attachmentTextBlocks(
      row({
        filename: "scan.pdf",
        textContent: JSON.stringify({
          pageCount: 1,
          pages: [{ page: 1, text: "SCAN-99417" }],
          fromOcr: true,
        }),
      }),
      true,
    );
    expect(blocks[0].filename).toBe("scan.pdf, page 1 (text recognised from the scan)");
  });

  // A hybrid document mixes the two, and only the recognised pages carry the hedge.
  it("labels page by page, not by document", () => {
    const blocks = attachmentTextBlocks(
      row({
        filename: "mixed.pdf",
        textContent: serializePdfText({
          pageCount: 2,
          pages: [
            { page: 1, text: "read from the layer" },
            { page: 2, text: "recognised", isFromOcr: true },
          ],
        }),
      }),
      true,
    );
    expect(blocks.map((b) => b.filename)).toEqual([
      "mixed.pdf, page 1",
      "mixed.pdf, page 2 (text recognised from the scan)",
    ]);
  });
});
