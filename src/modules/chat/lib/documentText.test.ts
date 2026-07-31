import {
  allocateBlocks,
  decodeDocumentText,
  foldBlocks,
  isImageMime,
  isTextDocument,
  textDocBlocks,
} from "@/modules/chat/lib/documentText";
import {
  DOCUMENT_TEXT_MAX_CHARS,
  DOCUMENT_TEXT_TOTAL_MAX_CHARS,
} from "@/modules/chat/constants";

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("isImageMime", () => {
  it("is true only for image/* types", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime(null)).toBe(false);
    expect(isImageMime(undefined)).toBe(false);
  });
});

describe("isTextDocument", () => {
  it("accepts text/* and known text MIME types", () => {
    expect(isTextDocument("text/plain", "notes.txt")).toBe(true);
    expect(isTextDocument("text/markdown", "readme.md")).toBe(true);
    expect(isTextDocument("application/json", "data.json")).toBe(true);
  });

  it("falls back to the file extension when the mime is generic", () => {
    expect(isTextDocument("application/octet-stream", "script.py")).toBe(true);
    expect(isTextDocument(undefined, "Component.tsx")).toBe(true);
    expect(isTextDocument(null, "query.sql")).toBe(true);
  });

  it("rejects images and binary documents", () => {
    expect(isTextDocument("image/png", "photo.png")).toBe(false);
    expect(isTextDocument("application/pdf", "cv.pdf")).toBe(false);
    expect(isTextDocument("application/octet-stream", "archive.zip")).toBe(
      false,
    );
    expect(isTextDocument(undefined, "noextension")).toBe(false);
  });
});

describe("decodeDocumentText", () => {
  it("decodes UTF-8 bytes back to the original string", () => {
    expect(decodeDocumentText(bytes("hello, world — café 日本語"))).toBe(
      "hello, world — café 日本語",
    );
  });
});

describe("textDocBlocks", () => {
  it("decodes documents and drops the binary ones", () => {
    const garbage = new Uint8Array(50).fill(0xff);
    expect(
      textDocBlocks([
        { filename: "a.txt", data: bytes("hello") },
        { filename: "blob.bin", data: garbage },
      ]),
    ).toEqual([{ filename: "a.txt", text: "hello" }]);
  });
});

describe("foldBlocks", () => {
  it("returns the base text unchanged when there is nothing to fold", () => {
    expect(foldBlocks("hello", [])).toBe("hello");
  });

  it("frames each block under its own label", () => {
    expect(
      foldBlocks("look", [
        { filename: "a.txt", text: "one" },
        { filename: "invoices.pdf, page 6", text: "two" },
      ]),
    ).toBe("look\n\n--- a.txt ---\none\n\n--- invoices.pdf, page 6 ---\ntwo");
  });
});

describe("allocateBlocks", () => {
  it("keeps a document that fits whole", () => {
    const alloc = allocateBlocks([[{ filename: "a.txt", text: "short" }]]);
    expect(alloc.groups[0][0].text).toBe("short");
    expect(alloc.isTruncated).toBe(false);
  });

  it("caps a single document at the per-file limit and marks the cut in the text", () => {
    const long = "x".repeat(DOCUMENT_TEXT_MAX_CHARS * 2);
    const alloc = allocateBlocks([[{ filename: "big.txt", text: long }]]);
    expect(alloc.groups[0][0].text).toContain("cut here");
    expect(alloc.groups[0][0].text).toContain(`of ${long.length} characters`);
    expect(alloc.isTruncated).toBe(true);
  });

  // A model asked for a value past the cut must not answer from a document it thinks it read whole.
  it("says a turn's document was omitted instead of dropping it in silence", () => {
    const long = "x".repeat(DOCUMENT_TEXT_MAX_CHARS);
    const fillers = Math.ceil(
      DOCUMENT_TEXT_TOTAL_MAX_CHARS / DOCUMENT_TEXT_MAX_CHARS,
    );
    const groups = [
      [{ filename: "oldest.txt", text: long }],
      ...Array.from({ length: fillers }, (_, i) => [
        { filename: `turn${i}.txt`, text: long },
      ]),
    ];
    const alloc = allocateBlocks(groups);
    expect(alloc.groups[0][0].filename).toBe("1 document part");
    expect(alloc.groups[0][0].text).toContain("omitted");
  });

  // Newest first is the whole point: the document just attached must arrive whole, and an older one yields.
  it("spends the conversation budget on the newest turns", () => {
    const long = "x".repeat(DOCUMENT_TEXT_MAX_CHARS);
    const fillers = Math.ceil(
      DOCUMENT_TEXT_TOTAL_MAX_CHARS / DOCUMENT_TEXT_MAX_CHARS,
    );
    const groups = Array.from({ length: fillers + 1 }, (_, i) => [
      { filename: `turn${i}.txt`, text: long },
    ]);
    const alloc = allocateBlocks(groups);
    expect(alloc.groups[groups.length - 1][0].text).toHaveLength(
      DOCUMENT_TEXT_MAX_CHARS,
    );
    expect(alloc.groups[0][0].text).toContain("omitted");
    expect(alloc.isTruncated).toBe(true);
  });

  it("drops an empty block instead of emitting an empty label", () => {
    const alloc = allocateBlocks([[{ filename: "scan.pdf", text: "" }]]);
    expect(alloc.groups[0]).toEqual([]);
  });
});
