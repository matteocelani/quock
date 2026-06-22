import { base64ToBytes, bytesToBase64, bytesToBase64Url } from "@/lib/encoding/base64";

function bytesOf(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe("bytesToBase64", () => {
  it("matches RFC 4648 reference vectors with padding", () => {
    expect(bytesToBase64(bytesOf())).toBe("");
    expect(bytesToBase64(new TextEncoder().encode("f"))).toBe("Zg==");
    expect(bytesToBase64(new TextEncoder().encode("fo"))).toBe("Zm8=");
    expect(bytesToBase64(new TextEncoder().encode("foo"))).toBe("Zm9v");
    expect(bytesToBase64(new TextEncoder().encode("foob"))).toBe("Zm9vYg==");
    expect(bytesToBase64(new TextEncoder().encode("fooba"))).toBe("Zm9vYmE=");
    expect(bytesToBase64(new TextEncoder().encode("foobar"))).toBe("Zm9vYmFy");
  });
});

describe("bytesToBase64Url", () => {
  it("matches RFC 4648 §5 reference vectors without padding", () => {
    expect(bytesToBase64Url(bytesOf(0x14, 0xfb, 0x9c, 0x03, 0xd9, 0x7e))).toBe(
      "FPucA9l-",
    );
    expect(bytesToBase64Url(bytesOf(0x14, 0xfb, 0x9c, 0x03, 0xd9))).toBe(
      "FPucA9k",
    );
  });
});

describe("base64ToBytes", () => {
  it("round-trips through bytesToBase64 for every length class", () => {
    const inputs = ["", "f", "fo", "foo", "foob", "fooba", "foobar"].map((s) =>
      new TextEncoder().encode(s),
    );
    for (const input of inputs) {
      const round = base64ToBytes(bytesToBase64(input));
      expect(Array.from(round)).toEqual(Array.from(input));
    }
  });

  it("decodes URL-safe base64 with or without padding", () => {
    expect(Array.from(base64ToBytes("FPucA9l-"))).toEqual([
      0x14, 0xfb, 0x9c, 0x03, 0xd9, 0x7e,
    ]);
  });
});
