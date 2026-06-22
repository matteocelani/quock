// Jest-only stand-in for `tweetnacl`. Routes Ed25519 sign/keyPair through
// Node's built-in `crypto` (which uses OpenSSL) so the unit tests exercise
// real Ed25519 math against the same RFC 8032 vectors the on-device
// tweetnacl bundle does. Behaviour-equivalent at the function-surface level,
// not bit-equivalent at the module-internal level.

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
} from "node:crypto";

const ED25519_SEED_BYTES = 32;
const ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SECRET_KEY_BYTES = 64;
const PKCS8_ED25519_PRIVATE_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

let prng: ((bytes: Uint8Array, length: number) => void) | null = null;

interface SignKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

function rawSeedToPkcs8Der(seed: Uint8Array): Buffer {
  if (seed.length !== ED25519_SEED_BYTES) {
    throw new Error(
      `Ed25519 seed must be ${ED25519_SEED_BYTES} bytes; got ${seed.length}`,
    );
  }
  return Buffer.concat([PKCS8_ED25519_PRIVATE_PREFIX, Buffer.from(seed)]);
}

function fromSeed(seed: Uint8Array): SignKeyPair {
  const der = rawSeedToPkcs8Der(seed);
  const privateKey = createPrivateKey({
    key: der,
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey(privateKey);
  const spki = publicKey.export({ format: "der", type: "spki" });
  const pubRaw = spki.subarray(spki.length - ED25519_PUBLIC_KEY_BYTES);
  const sk = new Uint8Array(ED25519_SECRET_KEY_BYTES);
  sk.set(seed, 0);
  sk.set(pubRaw, ED25519_SEED_BYTES);
  return {
    publicKey: new Uint8Array(pubRaw),
    secretKey: sk,
  };
}

function keyPair(): SignKeyPair {
  if (prng !== null) {
    const seed = new Uint8Array(ED25519_SEED_BYTES);
    prng(seed, ED25519_SEED_BYTES);
    return fromSeed(seed);
  }
  // Last-resort fall-back: Node-generated random key.
  const { privateKey } = generateKeyPairSync("ed25519");
  const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" });
  const seed = new Uint8Array(
    pkcs8.subarray(pkcs8.length - ED25519_SEED_BYTES),
  );
  return fromSeed(seed);
}

function fromSecretKey(secretKey: Uint8Array): SignKeyPair {
  if (secretKey.length !== ED25519_SECRET_KEY_BYTES) {
    throw new Error(
      `Ed25519 secret key must be ${ED25519_SECRET_KEY_BYTES} bytes`,
    );
  }
  return fromSeed(secretKey.subarray(0, ED25519_SEED_BYTES));
}

const keyPairWithStatics = Object.assign(keyPair, {
  fromSeed,
  fromSecretKey,
});

function signDetached(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  if (secretKey.length !== ED25519_SECRET_KEY_BYTES) {
    throw new Error(
      `Ed25519 secret key must be ${ED25519_SECRET_KEY_BYTES} bytes`,
    );
  }
  const seed = secretKey.subarray(0, ED25519_SEED_BYTES);
  const der = rawSeedToPkcs8Der(seed);
  const privateKey = createPrivateKey({
    key: der,
    format: "der",
    type: "pkcs8",
  });
  const sig = nodeSign(null, Buffer.from(message), privateKey);
  return new Uint8Array(sig.buffer, sig.byteOffset, sig.byteLength);
}

function signDetachedVerify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  if (publicKey.length !== ED25519_PUBLIC_KEY_BYTES) return false;
  if (signature.length !== 64) return false;
  // RFC 8410 SPKI prefix for Ed25519 public keys.
  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(publicKey),
  ]);
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  return nodeVerify(null, Buffer.from(message), key, Buffer.from(signature));
}

const detachedWithVerify = Object.assign(signDetached, {
  verify: signDetachedVerify,
});

const nacl = {
  setPRNG(p: (bytes: Uint8Array, length: number) => void): void {
    prng = p;
  },
  sign: {
    detached: detachedWithVerify,
    keyPair: keyPairWithStatics,
  },
};

export default nacl;
