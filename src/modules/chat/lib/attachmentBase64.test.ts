import {
  clearAttachmentBase64Cache,
  encodeAttachmentBase64,
} from "@/modules/chat/lib/attachmentBase64";
import { bytesToBase64 } from "@/lib/encoding/base64";
import { asAttachmentId } from "@/lib/types/ids";

beforeEach(clearAttachmentBase64Cache);

describe("encodeAttachmentBase64", () => {
  it("encodes exactly as the plain encoder does", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    expect(encodeAttachmentBase64(asAttachmentId(1), data)).toBe(
      bytesToBase64(data),
    );
  });

  // The point of the cache: a conversation re-sends the same image on every turn, and the encode is the expensive part.
  it("returns the same string for the same row without re-encoding", () => {
    const data = new Uint8Array([9, 8, 7]);
    const first = encodeAttachmentBase64(asAttachmentId(2), data);
    const second = encodeAttachmentBase64(asAttachmentId(2), data);
    expect(second).toBe(first);
  });

  it("keeps rows apart", () => {
    const a = encodeAttachmentBase64(asAttachmentId(3), new Uint8Array([1]));
    const b = encodeAttachmentBase64(asAttachmentId(4), new Uint8Array([2]));
    expect(a).not.toBe(b);
    expect(b).toBe(bytesToBase64(new Uint8Array([2])));
  });

  // A row whose byte length differs cannot be the same bytes, whatever the id says.
  it("re-encodes when the length does not match the cached entry", () => {
    const id = asAttachmentId(5);
    expect(encodeAttachmentBase64(id, new Uint8Array([1, 2, 3]))).toBe(
      bytesToBase64(new Uint8Array([1, 2, 3])),
    );
    expect(encodeAttachmentBase64(id, new Uint8Array([1, 2]))).toBe(
      bytesToBase64(new Uint8Array([1, 2])),
    );
  });
});
