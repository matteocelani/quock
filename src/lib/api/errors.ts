import type { MessageErrorCode } from "@/lib/db/types";

// Hook layer keys off `instanceof` here so React components never need try/catch (see 11.1/11.2).
export type CloudErrorCode =
  | "quota_exceeded"
  | "subscription_required"
  | "model_not_found"
  | "rate_limited"
  | "unknown";

// `code` is the discriminator the UI layer uses to pick user-facing copy.
export class CloudAPIError extends Error {
  public readonly status: number;
  public readonly code: CloudErrorCode;
  public readonly retryAfter?: number;
  constructor(
    status: number,
    code: CloudErrorCode = "unknown",
    retryAfter?: number,
    message?: string,
  ) {
    super(message ?? `Cloud API error: ${status} (${code})`);
    this.name = "CloudAPIError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    // Required for `instanceof` to work after ES5 transpile.
    Object.setPrototypeOf(this, CloudAPIError.prototype);
  }
  static isCloudAPIError(e: unknown): e is CloudAPIError {
    return e instanceof CloudAPIError;
  }
}
// Surfaces underlying `fetch` rejections (RN reports DNS/TLS/transport as TypeError).
export class NetworkError extends Error {
  public readonly cause?: unknown;
  constructor(cause?: unknown) {
    super("Network request failed");
    this.name = "NetworkError";
    this.cause = cause;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
// `atToken` is the count received so far, used by the "Continue" affordance.
export class StreamInterruptedError extends Error {
  public readonly atToken: number;
  constructor(atToken: number) {
    super(`Stream interrupted at token ${atToken}`);
    this.name = "StreamInterruptedError";
    this.atToken = atToken;
    Object.setPrototypeOf(this, StreamInterruptedError.prototype);
  }
}
// `signinUrl` is what the app opens in `expo-web-browser` to start OAuth.
export class AuthRequiredError extends Error {
  public readonly signinUrl?: string;
  constructor(signinUrl?: string) {
    super("Authentication required");
    this.name = "AuthRequiredError";
    this.signinUrl = signinUrl;
    Object.setPrototypeOf(this, AuthRequiredError.prototype);
  }
}
// Maps a thrown error or raw error string to the persisted `messages.error_code` discriminator.
export function deriveMessageErrorCode(err: unknown): MessageErrorCode {
  if (err instanceof CloudAPIError) {
    if (err.code === "subscription_required") return "subscription";
    if (err.code === "rate_limited" || err.code === "quota_exceeded") {
      return "subscription";
    }
    return "cloud";
  }
  if (err instanceof NetworkError) return "network";
  if (err instanceof Error) {
    const name = err.name.toLowerCase();
    if (name.includes("network") || name.includes("typeerror")) return "network";
  }
  if (typeof err === "string") {
    const lower = err.toLowerCase();
    if (lower.includes("network") || lower.includes("connection")) {
      return "network";
    }
    if (lower.includes("subscription") || lower.includes("usage limit")) {
      return "subscription";
    }
    return "cloud";
  }
  return "unknown";
}
