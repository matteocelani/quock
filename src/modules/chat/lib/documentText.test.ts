import {
  appendDocumentText,
  decodeDocumentText,
  isImageMime,
  isTextDocument,
} from "@/modules/chat/lib/documentText";

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

describe("appendDocumentText", () => {
  it("returns the base text unchanged when there are no documents", () => {
    expect(appendDocumentText("hello", [])).toBe("hello");
  });

  it("folds a document's text onto the message under a labelled block", () => {
    const out = appendDocumentText("summarise this", [
      { filename: "cv.txt", data: bytes("Jane Doe\nEngineer") },
    ]);
    expect(out).toBe("summarise this\n\n--- cv.txt ---\nJane Doe\nEngineer");
  });

  it("appends multiple documents in order", () => {
    const out = appendDocumentText("read these", [
      { filename: "a.txt", data: bytes("alpha") },
      { filename: "b.txt", data: bytes("beta") },
    ]);
    expect(out).toBe(
      "read these\n\n--- a.txt ---\nalpha\n\n--- b.txt ---\nbeta",
    );
  });

  it("skips a document that decodes to mostly replacement chars (binary)", () => {
    // 0xFF bytes are invalid UTF-8 → TextDecoder emits U+FFFD for each.
    const garbage = new Uint8Array(50).fill(0xff);
    expect(
      appendDocumentText("base", [{ filename: "blob.bin", data: garbage }]),
    ).toBe("base");
  });
});
