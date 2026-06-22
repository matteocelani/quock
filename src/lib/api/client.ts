import { fetch as expoFetch } from "expo/fetch";
import type { Keypair } from "@/modules/auth/lib/keypair";
import { signRequest } from "@/modules/auth/lib/sign";
import {
  AuthRequiredError,
  CloudAPIError,
  type CloudErrorCode,
  NetworkError,
} from "@/lib/api/errors";

export interface ApiClientOptions {
  baseUrl: string;
  // Resolves the device's Ed25519 keypair before every request so SecureStore can be lazy-loaded and a future "rotate keypair" path can plug in here.
  getKeypair: () => Keypair | null | Promise<Keypair | null>;
  // Lets the auth slice react to 401s (clear cached user, navigate to login).
  onAuthExpired?: (signinUrl?: string) => void;
}
// Server is inconsistent about which fields it sets, so all are optional.
interface CloudErrorBody {
  code?: string;
  message?: string;
  error?: string;
  signin_url?: string;
}

const RETRYABLE_HTTP_METHODS_WITH_BODY: ReadonlySet<string> = new Set([
  "POST",
  "PUT",
  "PATCH",
]);
// Server-side gate for paid models: returns 403 with a `subscription` keyword in the message. Detected here so the UI can show an upgrade modal.
const HTTP_STATUS_FORBIDDEN = 403;
const SUBSCRIPTION_KEYWORD = "subscription";
// Single fetch surface for the app: signs every request with the device key, adds JSON content-type for write methods, translates non-2xx into the centralized error catalog.
export class ApiClient {
  private readonly baseUrl: string;
  private readonly getKeypair: ApiClientOptions["getKeypair"];
  private readonly onAuthExpired?: ApiClientOptions["onAuthExpired"];
  constructor(opts: ApiClientOptions) {
    // Strip any trailing slash so concatenation with `/api/...` is clean.
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.getKeypair = opts.getKeypair;
    this.onAuthExpired = opts.onAuthExpired;
  }
  // Returns the raw Response on 2xx; throws a typed error otherwise.
  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    const { url, authorization } = await this.signOrFallback(method, path);
    const headers = this.buildHeaders(init, authorization);

    let response: Response;
    try {
      // `credentials: "omit"` keeps NSURLSession's shared cookie jar (which is shared with Safari/AuthSession) from auto-attaching ollama.com session cookies. The Ed25519 signature is the ONLY identity the server should see — otherwise a stale Safari sign-in can bypass our keypair flow.
      // `expo/fetch` (vs global fetch) exposes `response.body` as a real ReadableStream on iOS so JSONL streaming actually works.
      response = (await expoFetch(url, {
        ...init,
        method,
        headers,
        credentials: "omit",
      })) as unknown as Response;
    } catch (cause) {
      // RN fetch rejects with TypeError on transport failure; funnel into NetworkError.
      if (cause instanceof TypeError) {
        throw new NetworkError(cause);
      }
      throw cause;
    }
    if (response.ok) {
      return response;
    }

    const body = await readErrorBody(response);
    throw this.translateError(response, body);
  }
  async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetch(path, init);
    return (await response.json()) as T;
  }
  // `signal` is forwarded into `init` only if the caller hasn't set one already.
  async stream(
    path: string,
    init: RequestInit = {},
    signal?: AbortSignal,
  ): Promise<Response> {
    const merged: RequestInit = signal
      ? { ...init, signal: init.signal ?? signal }
      : init;
    return this.fetch(path, merged);
  }
  // Path-only paths (`/api/...`) are signed; absolute URLs pass through unsigned so external callbacks (avatar URLs, etc.) aren't broken.
  private async signOrFallback(
    method: string,
    path: string,
  ): Promise<{ url: string; authorization: string | null }> {
    if (!path.startsWith("/")) {
      return { url: path, authorization: null };
    }

    const keypair = await this.getKeypair();
    if (keypair === null) {
      return { url: `${this.baseUrl}${path}`, authorization: null };
    }

    const signed = signRequest(method, this.baseUrl, path, keypair);
    return { url: signed.url, authorization: signed.authorization };
  }
  private buildHeaders(
    init: RequestInit,
    authorization: string | null,
  ): Headers {
    const headers = new Headers(init.headers);
    if (authorization !== null && !headers.has("Authorization")) {
      headers.set("Authorization", authorization);
    }
    // Only auto-set JSON content-type for plain JSON bodies on write methods.
    const method = (init.method ?? "GET").toUpperCase();
    if (
      RETRYABLE_HTTP_METHODS_WITH_BODY.has(method) &&
      init.body !== undefined &&
      init.body !== null &&
      !headers.has("Content-Type") &&
      isJsonBody(init.body)
    ) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  }
  private translateError(
    response: Response,
    body: CloudErrorBody | null,
  ): Error {
    const status = response.status;
    const code = body?.code;
    if (status === 401) {
      const signinUrl = body?.signin_url;
      this.onAuthExpired?.(signinUrl);
      return new AuthRequiredError(signinUrl);
    }
    if (status === 429) {
      const retryAfter = parseRetryAfter(response);
      return new CloudAPIError(
        429,
        "rate_limited",
        retryAfter,
        body?.message ?? body?.error,
      );
    }
    if (status === 402 || code === "quota_exceeded") {
      return new CloudAPIError(
        status,
        "quota_exceeded",
        undefined,
        body?.message ?? body?.error,
      );
    }

    const subscriptionMessage = body?.message ?? body?.error;
    if (
      status === HTTP_STATUS_FORBIDDEN &&
      typeof subscriptionMessage === "string" &&
      subscriptionMessage.toLowerCase().includes(SUBSCRIPTION_KEYWORD)
    ) {
      return new CloudAPIError(
        status,
        "subscription_required",
        undefined,
        subscriptionMessage,
      );
    }
    if (code === "model_not_found") {
      return new CloudAPIError(
        status,
        "model_not_found",
        undefined,
        body?.message ?? body?.error,
      );
    }
    // 5xx and uncategorized 4xx fall through to a generic bucket the UI surfaces as a toast.
    const errorCode: CloudErrorCode = "unknown";
    return new CloudAPIError(
      status,
      errorCode,
      undefined,
      body?.message ?? body?.error,
    );
  }
}
// Defends against HTML/plain-text error pages in addition to JSON.
async function readErrorBody(
  response: Response,
): Promise<CloudErrorBody | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as CloudErrorBody;
  } catch {
    return null;
  }
}
// Only the delta-seconds integer form is supported; HTTP-date is rare for our cloud.
function parseRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get("Retry-After");
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
// Strings are assumed to be pre-serialized JSON; binary/multipart bodies are not.
function isJsonBody(body: BodyInit): boolean {
  if (typeof body === "string") return true;
  if (typeof FormData !== "undefined" && body instanceof FormData) return false;
  if (typeof Blob !== "undefined" && body instanceof Blob) return false;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams)
    return false;
  if (body instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(body)) return false;
  return true;
}
