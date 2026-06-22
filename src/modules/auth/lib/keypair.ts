// Generates and persists an Ed25519 keypair in expo-secure-store. The keypair IS the identity in Ollama's signed-request auth scheme — see `auth/auth.go`.

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import nacl from "tweetnacl";

import { base64ToBytes, bytesToBase64 } from "@/lib/encoding/base64";
import { ED25519_PUBLIC_KEY_BYTES, ED25519_SECRET_KEY_BYTES, ED25519_SEED_BYTES, KEYPAIR_SEED_STORE_KEY, SSH_ED25519_TYPE, SSH_LENGTH_PREFIX_BYTES } from "@/modules/auth/constants";

export interface Keypair {
  // 32 bytes; matches the raw form returned by tweetnacl.
  publicKey: Uint8Array;
  // 64 bytes (seed[32] || pubkey[32]); tweetnacl's secret key layout.
  secretKey: Uint8Array;
}

// tweetnacl's nacl.sign.keyPair() throws "no PRNG" unless we install one. expo-crypto.getRandomValues maps to SecRandomCopyBytes / java.security on the respective platforms, so this is cryptographically sound.
let hasInstalledPrng = false;
function ensurePrng(): void {
  if (hasInstalledPrng) return;
  hasInstalledPrng = true;
  nacl.setPRNG((bytes, length) => {
    const tmp = new Uint8Array(length);
    Crypto.getRandomValues(tmp);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = tmp[i];
    }
  });
}

function deriveKeypairFromSeed(seed: Uint8Array): Keypair {
  if (seed.length !== ED25519_SEED_BYTES) {
    throw new Error(
      `Invalid seed length: expected ${ED25519_SEED_BYTES}, got ${seed.length}`,
    );
  }
  const pair = nacl.sign.keyPair.fromSeed(seed);
  if (pair.publicKey.length !== ED25519_PUBLIC_KEY_BYTES) {
    throw new Error(`Derived publicKey wrong length: ${pair.publicKey.length}`);
  }
  if (pair.secretKey.length !== ED25519_SECRET_KEY_BYTES) {
    throw new Error(`Derived secretKey wrong length: ${pair.secretKey.length}`);
  }
  return { publicKey: pair.publicKey, secretKey: pair.secretKey };
}

// Returns the device's Ed25519 keypair. On first call generates a seed and persists it to SecureStore; subsequent calls reload the same identity.
// In-flight de-dup: concurrent first-callers share ONE init so an empty SecureStore can't be raced into two seeds; cleared once settled, so a later signOut still re-reads fresh.
let keypairInFlight: Promise<Keypair> | null = null;
export function loadOrCreateKeypair(): Promise<Keypair> {
  if (keypairInFlight !== null) return keypairInFlight;
  keypairInFlight = loadOrCreateKeypairUncached();
  void keypairInFlight.finally(() => {
    keypairInFlight = null;
  });
  return keypairInFlight;
}

// Drops any in-flight load so the next loadOrCreateKeypair() re-reads SecureStore. Runs on sign-out: else a load
// begun before the seed wipe would still hand a post-sign-out caller the previous account's key.
export function clearKeypairInFlight(): void {
  keypairInFlight = null;
}

async function loadOrCreateKeypairUncached(): Promise<Keypair> {
  ensurePrng();

  const stored = await SecureStore.getItemAsync(KEYPAIR_SEED_STORE_KEY);
  if (stored !== null && stored.length > 0) {
    try {
      const seed = base64ToBytes(stored);
      return deriveKeypairFromSeed(seed);
    } catch (cause) {
      // Corrupt store entry: fall through and regenerate so the app stays usable.
      console.warn(
        "loadOrCreateKeypair: stored seed unreadable, regenerating",
        cause,
      );
    }
  }

  const seed = new Uint8Array(ED25519_SEED_BYTES);
  Crypto.getRandomValues(seed);
  try {
    await SecureStore.setItemAsync(KEYPAIR_SEED_STORE_KEY, bytesToBase64(seed));
  } catch (err) {
    // SecureStore can be unavailable (locked keychain, disk pressure). Return the freshly-derived in-memory
    // keypair anyway so the call doesn't throw/reject per request; it just won't persist across restart.
    console.warn(
      "loadOrCreateKeypair: seed persist failed; using in-memory keypair",
      err,
    );
  }
  return deriveKeypairFromSeed(seed);
}

// Encodes an Ed25519 public key as the SSH wire format used by `ssh.MarshalAuthorizedKey`: length-prefixed type then length-prefixed key.
export function encodeSshEd25519PublicKey(pubkey: Uint8Array): Uint8Array {
  if (pubkey.length !== ED25519_PUBLIC_KEY_BYTES) {
    throw new Error(
      `encodeSshEd25519PublicKey: pubkey must be ${ED25519_PUBLIC_KEY_BYTES} bytes`,
    );
  }
  const typeBytes = new TextEncoder().encode(SSH_ED25519_TYPE);
  const totalLength =
    SSH_LENGTH_PREFIX_BYTES +
    typeBytes.length +
    SSH_LENGTH_PREFIX_BYTES +
    pubkey.length;
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);

  let offset = 0;
  view.setUint32(offset, typeBytes.length, false);
  offset += SSH_LENGTH_PREFIX_BYTES;
  out.set(typeBytes, offset);
  offset += typeBytes.length;
  view.setUint32(offset, pubkey.length, false);
  offset += SSH_LENGTH_PREFIX_BYTES;
  out.set(pubkey, offset);
  return out;
}

// Mirrors `ssh.MarshalAuthorizedKey`: `ssh-ed25519 <std-base64-wire>`. Go's stdlib `ssh.MarshalAuthorizedKey` produces NO comment field — only the type and wire base64 separated by a single space. The desktop calls `strings.TrimSpace` on it (auth/auth.go:39-41) before base64url-encoding for the connect URL. The server splits the decoded payload on spaces and expects exactly two tokens; any third whitespace-separated field (e.g. a device name) is rejected as "invalid key format". The device name belongs in the `name=` query parameter, not in the key payload.
export function getSshAuthorizedKeyLine(pubkey: Uint8Array): string {
  const wire = encodeSshEd25519PublicKey(pubkey);
  return `${SSH_ED25519_TYPE} ${bytesToBase64(wire)}`;
}

// Test-only escape hatch. Lets the unit test seed a deterministic keypair without monkey-patching SecureStore.
export function __deriveKeypairFromSeedForTest(seed: Uint8Array): Keypair {
  return deriveKeypairFromSeed(seed);
}
