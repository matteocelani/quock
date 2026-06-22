import nacl from "tweetnacl";

import { base64ToBytes } from "@/lib/encoding/base64";
import { __deriveKeypairFromSeedForTest } from "@/modules/auth/lib/keypair";
import { signRequest } from "@/modules/auth/lib/sign";

// Fixed-seed (all-zero) Ed25519 keypair makes `signRequest` deterministic across runs; matches RFC 8032 §7.1 "Test 1" so the test is reproducible.
const ALL_ZERO_SEED = new Uint8Array(32);
const FIXED_TIMESTAMP = 1700000000;

describe("signRequest", () => {
  it("produces a deterministic signature for fixed inputs", () => {
    const keypair = __deriveKeypairFromSeedForTest(ALL_ZERO_SEED);
    const a = signRequest("GET", "https://ollama.com", "/api/me", keypair, {
      now: FIXED_TIMESTAMP,
    });
    const b = signRequest("GET", "https://ollama.com", "/api/me", keypair, {
      now: FIXED_TIMESTAMP,
    });
    expect(a.authorization).toBe(b.authorization);
    expect(a.url).toBe(b.url);
  });

  it("builds METHOD,PATH?ts=TS as the signed message and a `Bearer wirepub:sig` header", () => {
    const keypair = __deriveKeypairFromSeedForTest(ALL_ZERO_SEED);
    const signed = signRequest(
      "POST",
      "https://ollama.com",
      "/api/me",
      keypair,
      {
        now: FIXED_TIMESTAMP,
      },
    );

    expect(signed.method).toBe("POST");
    expect(signed.path).toBe("/api/me");
    expect(signed.url).toBe(`https://ollama.com/api/me?ts=${FIXED_TIMESTAMP}`);
    expect(signed.timestamp).toBe(FIXED_TIMESTAMP);

    const prefix = "Bearer ";
    expect(signed.authorization.startsWith(prefix)).toBe(true);
    const payload = signed.authorization.slice(prefix.length);
    const parts = payload.split(":");
    expect(parts).toHaveLength(2);

    const [wirePubB64, sigB64] = parts;
    const sigBytes = base64ToBytes(sigB64);
    expect(sigBytes.length).toBe(64);

    const stringToSign = `POST,/api/me?ts=${FIXED_TIMESTAMP}`;
    const messageBytes = new TextEncoder().encode(stringToSign);
    const ok = nacl.sign.detached.verify(
      messageBytes,
      sigBytes,
      keypair.publicKey,
    );
    expect(ok).toBe(true);
    expect(wirePubB64.length).toBeGreaterThan(0);
  });

  it("normalizes the method to upper-case and pads the path with a leading slash", () => {
    const keypair = __deriveKeypairFromSeedForTest(ALL_ZERO_SEED);
    const signed = signRequest(
      "get",
      "https://ollama.com/",
      "api/me",
      keypair,
      {
        now: FIXED_TIMESTAMP,
      },
    );
    expect(signed.method).toBe("GET");
    expect(signed.path).toBe("/api/me");
    expect(signed.url).toBe(`https://ollama.com/api/me?ts=${FIXED_TIMESTAMP}`);
  });
});
