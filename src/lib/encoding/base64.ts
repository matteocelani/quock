// Standard + URL-safe Base64 helpers without relying on `atob`/`btoa`, which are not guaranteed to handle binary data identically across Hermes/JSC. Mirrors Go's `encoding/base64` StdEncoding and RawURLEncoding.

const STD_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const BYTES_PER_BASE64_GROUP = 3;
const BASE64_GROUP_BITS = 6;
const BASE64_PAIR_BITS = BASE64_GROUP_BITS * 2;
// Two output characters looked up once instead of indexed twice: an image is megabytes of this loop on the JS thread.
// Built once per alphabet on first use, paid by whichever caller encodes first.
const PAIR_TABLE_SIZE = 1 << BASE64_PAIR_BITS;
const pairTables = new Map<string, string[]>();

function pairTable(alphabet: string): string[] {
  const cached = pairTables.get(alphabet);
  if (cached !== undefined) return cached;
  const table = new Array<string>(PAIR_TABLE_SIZE);
  for (let i = 0; i < PAIR_TABLE_SIZE; i += 1) {
    table[i] = alphabet[i >> BASE64_GROUP_BITS] + alphabet[i & 0x3f];
  }
  pairTables.set(alphabet, table);
  return table;
}

function encodeWithAlphabet(
  bytes: Uint8Array,
  alphabet: string,
  withPadding: boolean,
): string {
  const pairs = pairTable(alphabet);
  let out = "";
  let i = 0;
  for (
    ;
    i + BYTES_PER_BASE64_GROUP <= bytes.length;
    i += BYTES_PER_BASE64_GROUP
  ) {
    // Three bytes are two 12-bit indexes: the high half and the low half of the group.
    const group = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += pairs[group >> BASE64_PAIR_BITS];
    out += pairs[group & 0xfff];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const b0 = bytes[i];
    out += alphabet[b0 >> 2];
    out += alphabet[(b0 & 0x03) << 4];
    if (withPadding) out += "==";
  } else if (remaining === 2) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    out += alphabet[b0 >> 2];
    out += alphabet[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += alphabet[(b1 & 0x0f) << 2];
    if (withPadding) out += "=";
  }
  return out;
}

// Standard RFC 4648 §4 base64 with padding.
export function bytesToBase64(bytes: Uint8Array): string {
  return encodeWithAlphabet(bytes, STD_ALPHABET, true);
}

// RFC 4648 §5 base64url, no padding. Matches Go's `base64.RawURLEncoding`.
export function bytesToBase64Url(bytes: Uint8Array): string {
  return encodeWithAlphabet(bytes, URL_ALPHABET, false);
}

function decodeChar(c: number): number {
  if (c >= 65 && c <= 90) return c - 65;
  if (c >= 97 && c <= 122) return c - 97 + 26;
  if (c >= 48 && c <= 57) return c - 48 + 52;
  if (c === 43 || c === 45) return 62;
  if (c === 47 || c === 95) return 63;
  throw new Error(`Invalid base64 character: ${c}`);
}

// Decodes both standard and URL-safe base64, with or without padding.
export function base64ToBytes(s: string): Uint8Array {
  const stripped = s.replace(/=+$/, "");
  const len = stripped.length;
  const bits = len * BASE64_GROUP_BITS;
  const bitsPerByte = 8;
  const byteLength = Math.floor(bits / bitsPerByte);
  const out = new Uint8Array(byteLength);

  let outIdx = 0;
  let buffer = 0;
  let bufferBits = 0;
  for (let i = 0; i < len; i += 1) {
    const v = decodeChar(stripped.charCodeAt(i));
    buffer = (buffer << BASE64_GROUP_BITS) | v;
    bufferBits += BASE64_GROUP_BITS;
    if (bufferBits >= bitsPerByte) {
      bufferBits -= bitsPerByte;
      out[outIdx] = (buffer >> bufferBits) & 0xff;
      outIdx += 1;
    }
  }
  return out;
}
