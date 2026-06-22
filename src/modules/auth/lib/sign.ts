// Signs an outgoing HTTP request with the device's Ed25519 keypair using the Ollama self-signed scheme. The string to sign is `METHOD,PATH?ts=TIMESTAMP` (see `app/ui/ui.go#doSelfSigned`); the wire form of the public key is embedded in the Authorization header so the server can verify without looking the key up.

import nacl from "tweetnacl";

import { bytesToBase64 } from "@/lib/encoding/base64";
import { encodeSshEd25519PublicKey, type Keypair } from "@/modules/auth/lib/keypair";

export interface SignedRequest {
  method: string;
  path: string;
  // Full URL including the `?ts=NNN` query the server requires.
  url: string;
  // `Bearer <wire_pubkey_b64>:<signature_b64>` — drop into Authorization as-is.
  authorization: string;
  timestamp: number;
}

const MILLIS_PER_SECOND = 1000;

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / MILLIS_PER_SECOND);
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

export interface SignOptions {
  // Overrides for deterministic testing. Not used in production.
  now?: number;
}

// Signs `${METHOD},${PATH}?ts=${TIMESTAMP}` using Ed25519. The signature and the SSH-wire public key are base64 (standard) encoded and joined with `:`.
export function signRequest(
  method: string,
  baseUrl: string,
  path: string,
  keypair: Keypair,
  options: SignOptions = {},
): SignedRequest {
  const timestamp = options.now ?? currentUnixSeconds();
  const upperMethod = method.toUpperCase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const stringToSign = `${upperMethod},${normalizedPath}?ts=${timestamp}`;
  const messageBytes = new TextEncoder().encode(stringToSign);

  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureB64 = bytesToBase64(signature);
  const pubkeyWireB64 = bytesToBase64(
    encodeSshEd25519PublicKey(keypair.publicKey),
  );

  const url = `${joinUrl(baseUrl, path)}?ts=${timestamp}`;
  const authorization = `Bearer ${pubkeyWireB64}:${signatureB64}`;

  return {
    method: upperMethod,
    path: normalizedPath,
    url,
    authorization,
    timestamp,
  };
}
