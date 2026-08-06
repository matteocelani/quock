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

  it("survives stored text that is not readable", () => {
    expect(
      attachmentTextBlocks(row({ textContent: "{not json" }), true),
    ).toEqual([]);
  });
});
