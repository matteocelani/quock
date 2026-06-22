// Builds the `${baseURL}/connect?...` URL the Ollama account site expects in order to bind a device's Ed25519 public key. Mirrors `app/auth/connect.go#BuildConnectURL` byte-for-byte so the server validates identically.

import { bytesToBase64Url } from "@/lib/encoding/base64";
import { getSshAuthorizedKeyLine } from "@/modules/auth/lib/keypair";

export function buildConnectUrl(
  baseUrl: string,
  deviceName: string,
  pubkey: Uint8Array,
): string {
  // Go builds the authorized_keys line (no comment, no trailing newline after `strings.TrimSpace`) and then base64url-encodes the bytes. The device name travels in the `name=` query parameter only — never embedded in the key payload (otherwise the server's parser rejects extra space-separated tokens as "invalid key format").
  const authorizedKeyLine = getSshAuthorizedKeyLine(pubkey);
  const keyBytes = new TextEncoder().encode(authorizedKeyLine);
  const encodedKey = bytesToBase64Url(keyBytes);
  const encodedDevice = encodeURIComponent(deviceName);
  const trimmedBase = baseUrl.replace(/\/$/, "");
  return `${trimmedBase}/connect?name=${encodedDevice}&key=${encodedKey}&launch=true`;
}
