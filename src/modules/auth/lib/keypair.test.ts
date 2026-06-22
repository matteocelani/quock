import * as SecureStoreMock from "expo-secure-store";

import { bytesToBase64 } from "@/lib/encoding/base64";
import {
  __deriveKeypairFromSeedForTest,
  encodeSshEd25519PublicKey,
  getSshAuthorizedKeyLine,
  loadOrCreateKeypair,
} from "@/modules/auth/lib/keypair";

const ALL_ZERO_SEED = new Uint8Array(32);

describe("encodeSshEd25519PublicKey", () => {
  it("emits a length-prefixed `ssh-ed25519` block followed by the 32-byte key", () => {
    const pubkey = new Uint8Array(32).fill(0xab);
    const out = encodeSshEd25519PublicKey(pubkey);
    // 4 (type-len) + 11 ("ssh-ed25519") + 4 (key-len) + 32 (key) = 51.
    expect(out.length).toBe(51);
    // 32-bit big-endian length prefix for the type string.
    expect(Array.from(out.slice(0, 4))).toEqual([0, 0, 0, 11]);
    expect(new TextDecoder().decode(out.slice(4, 15))).toBe("ssh-ed25519");
    expect(Array.from(out.slice(15, 19))).toEqual([0, 0, 0, 32]);
    expect(Array.from(out.slice(19, 51))).toEqual(Array(32).fill(0xab));
  });

  it("rejects keys that are not exactly 32 bytes", () => {
    expect(() => encodeSshEd25519PublicKey(new Uint8Array(31))).toThrow(
      /must be 32 bytes/,
    );
  });
});

describe("getSshAuthorizedKeyLine", () => {
  it("formats the line as `ssh-ed25519 <base64-wire>` (no comment, no newline)", () => {
    const keypair = __deriveKeypairFromSeedForTest(ALL_ZERO_SEED);
    const line = getSshAuthorizedKeyLine(keypair.publicKey);
    expect(line.startsWith("ssh-ed25519 ")).toBe(true);
    expect(line.endsWith("\n")).toBe(false);
    expect(line.split(" ")).toHaveLength(2);
    const wireB64 = line.split(" ")[1];
    // wire base64 should round-trip via our codec.
    const expectedWire = bytesToBase64(
      encodeSshEd25519PublicKey(keypair.publicKey),
    );
    expect(wireB64).toBe(expectedWire);
  });
});

describe("loadOrCreateKeypair", () => {
  beforeEach(() => {
    const mock = SecureStoreMock as unknown as { __resetForTest: () => void };
    mock.__resetForTest();
  });

  it("persists and re-loads the same keypair across calls", async () => {
    const first = await loadOrCreateKeypair();
    const second = await loadOrCreateKeypair();
    expect(Array.from(first.publicKey)).toEqual(Array.from(second.publicKey));
    expect(Array.from(first.secretKey)).toEqual(Array.from(second.secretKey));
    expect(first.publicKey.length).toBe(32);
    expect(first.secretKey.length).toBe(64);
  });
});
