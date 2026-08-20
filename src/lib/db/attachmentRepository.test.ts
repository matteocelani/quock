import { groupByMessageId } from "@/lib/db/attachmentRepository";
import type { DbAttachment } from "@/lib/db/types";
import { asAttachmentId, asMessageId } from "@/lib/types/ids";

function att(id: number, messageId: number): DbAttachment {
  return {
    id: asAttachmentId(id),
    messageId: asMessageId(messageId),
    filename: `f${id}.jpg`,
    mimeType: "image/jpeg",
    data: new Uint8Array([id]),
    uri: null,
    sizeBytes: 1,
    textContent: null,
    derivedFrom: null,
  };
}

describe("groupByMessageId", () => {
  it("keeps every attachment of a message together, in the order given", () => {
    const grouped = groupByMessageId([att(1, 10), att(2, 20), att(3, 10)]);
    expect([...grouped.keys()]).toEqual([asMessageId(10), asMessageId(20)]);
    expect(grouped.get(asMessageId(10))?.map((a) => a.id)).toEqual([
      asAttachmentId(1),
      asAttachmentId(3),
    ]);
  });

  // The loop this replaced only created an entry when a message had attachments, and callers read a miss as "none".
  it("creates no entry for a message that owns nothing", () => {
    const grouped = groupByMessageId([att(1, 10)]);
    expect(grouped.has(asMessageId(99))).toBe(false);
    expect(grouped.get(asMessageId(99))).toBeUndefined();
  });

  it("returns an empty map for no rows", () => {
    expect(groupByMessageId([]).size).toBe(0);
  });
});
