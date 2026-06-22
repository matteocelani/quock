import { base64ToBytes } from "@/lib/encoding/base64";
import { buildConnectUrl } from "@/modules/auth/lib/connect";
import {
  __deriveKeypairFromSeedForTest,
  getSshAuthorizedKeyLine,
} from "@/modules/auth/lib/keypair";

const ALL_ZERO_SEED = new Uint8Array(32);

describe("buildConnectUrl", () => {
  it("emits ${base}/connect?name&key&launch=true with a base64url-encoded authorized-keys line", () => {
    const keypair = __deriveKeypairFromSeedForTest(ALL_ZERO_SEED);
    const url = buildConnectUrl(
      "https://ollama.com",
      "test-device",
      keypair.publicKey,
    );
    expect(url.startsWith("https://ollama.com/connect?")).toBe(true);
    expect(url).toContain("name=test-device");
    expect(url.endsWith("&launch=true")).toBe(true);

    // Decode the `key=` param: it must round-trip to the authorized-keys line we generate locally — no comment, no trailing newline (matches Go).
    const params = new URL(url).searchParams;
    const keyParam = params.get("key");
    expect(keyParam).not.toBeNull();
    // Standard URL parsing treats `-_` like normal chars; convert to bytes via our own base64url decoder so we exercise the same path the server does.
    const decoded = base64ToBytes(keyParam ?? "");
    const expected = new TextEncoder().encode(
      getSshAuthorizedKeyLine(keypair.publicKey),
    );
    expect(Array.from(decoded)).toEqual(Array.from(expected));
  });

  it("URL-encodes spaces and parentheses in the device name", () => {
    const keypair = __deriveKeypairFromSeedForTest(ALL_ZERO_SEED);
    const url = buildConnectUrl(
      "https://ollama.com",
      "Ollama Mobile (iOS)",
      keypair.publicKey,
    );
    expect(url).toContain("name=Ollama%20Mobile%20(iOS)");
  });
});
