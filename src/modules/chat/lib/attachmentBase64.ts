// The wire carries images as base64 and `/api/chat` is stateless, so the same picture is re-encoded on every turn of a
// conversation. Encoding is a pure JS loop over megabytes, so the second turn onward reads it from here instead.

import { bytesToBase64 } from "@/lib/encoding/base64";
import { ATTACHMENT_REPLAY_MAX_BYTES } from "@/modules/chat/constants";
import type { AttachmentId } from "@/lib/types/ids";

// An attachment row's bytes never change once written (insert-only; only `text_content` is ever updated), and SQLite's
// AUTOINCREMENT never reuses an id, so the id alone identifies the bytes for good. The length is belt and braces.
function keyOf(id: AttachmentId, byteLength: number): string {
  return `${id}:${byteLength}`;
}

const cache = new Map<string, string>();
let cachedChars = 0;
// Bounded by what a turn may replay, so the cache can never hold more than one turn's worth of payload.
const MAX_CHARS = Math.ceil((ATTACHMENT_REPLAY_MAX_BYTES * 4) / 3);

export function encodeAttachmentBase64(
  id: AttachmentId,
  data: Uint8Array,
): string {
  const key = keyOf(id, data.byteLength);
  const hit = cache.get(key);
  if (hit !== undefined) {
    // Re-inserting moves it to the end, which makes the plain Map an LRU: iteration order is insertion order.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const encoded = bytesToBase64(data);
  cache.set(key, encoded);
  cachedChars += encoded.length;
  while (cachedChars > MAX_CHARS) {
    const oldest = cache.keys().next();
    if (oldest.done === true) break;
    const evicted = cache.get(oldest.value);
    cache.delete(oldest.value);
    cachedChars -= evicted?.length ?? 0;
  }
  return encoded;
}

// Called when the rows themselves are wiped, since the keys point at ids that no longer exist. Also the seam a suite
// asserting on hits needs to start from empty.
export function clearAttachmentBase64Cache(): void {
  cache.clear();
  cachedChars = 0;
}
