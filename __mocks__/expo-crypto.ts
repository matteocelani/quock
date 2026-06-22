// Deterministic UUID generator for tests. The real `expo-crypto.randomUUID`
// returns a cryptographically-random RFC 4122 v4 string which makes assertions
// brittle. The mock returns a monotonically increasing `test-uuid-N` string,
// so tests can reason about the sequence of generated ids.

let counter = 0;

export function randomUUID(): string {
  counter += 1;
  return `test-uuid-${counter}`;
}

// Test helper. Call from `beforeEach` to reset the counter so each test
// starts at `test-uuid-1`.
export function __resetForTest(): void {
  counter = 0;
}

// `digestStringAsync` is occasionally used to hash file contents. The mock
// returns a deterministic pseudo-hash based on the input length so callers
// that compare hashes for equality still work without bringing in a real
// crypto dependency.
export async function digestStringAsync(
  _algorithm: string,
  data: string,
): Promise<string> {
  return `test-digest-${data.length}`;
}

// Deterministic byte filler so keypair / signing tests are reproducible.
// Counter-based fill avoids real randomness while still keeping callers happy
// when they ask for "secure" bytes under the Jest runtime.
let randomCounter = 0;
export function getRandomValues<T extends ArrayBufferView>(typedArray: T): T {
  const bytes = new Uint8Array(
    typedArray.buffer,
    typedArray.byteOffset,
    typedArray.byteLength,
  );
  for (let i = 0; i < bytes.length; i += 1) {
    randomCounter = (randomCounter + 1) & 0xff;
    bytes[i] = randomCounter;
  }
  return typedArray;
}

export function getRandomBytes(byteCount: number): Uint8Array {
  return getRandomValues(new Uint8Array(byteCount));
}

export async function getRandomBytesAsync(
  byteCount: number,
): Promise<Uint8Array> {
  return getRandomBytes(byteCount);
}

export function __resetRandomForTest(): void {
  randomCounter = 0;
}

export enum CryptoDigestAlgorithm {
  SHA1 = "SHA-1",
  SHA256 = "SHA-256",
  SHA384 = "SHA-384",
  SHA512 = "SHA-512",
  MD2 = "MD2",
  MD4 = "MD4",
  MD5 = "MD5",
}
