import { __deriveKeypairFromSeedForTest, type Keypair } from "@/modules/auth/lib/keypair";
import { ApiClient } from "@/lib/api/client";
import { AuthRequiredError, CloudAPIError, NetworkError } from "@/lib/api/errors";

// Typed wrapper around `global.fetch` to avoid `any` casts at every call site.
type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit?]>;

function installFetchMock(): FetchMock {
  const m = jest.fn() as FetchMock;
  // Narrowed cast keeps strict mode happy without mutating the global type.
  (globalThis as { fetch: typeof fetch }).fetch = m as unknown as typeof fetch;
  return m;
}

function jsonResponse(
  status: number,
  body: unknown,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

// Fixed test seed so signing is deterministic and assertions never flake.
const TEST_SEED = new Uint8Array(32).fill(7);

function makeKeypair(): Keypair {
  return __deriveKeypairFromSeedForTest(TEST_SEED);
}

describe("ApiClient", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  const makeClient = (
    keypair: Keypair | null = makeKeypair(),
    onAuthExpired?: jest.Mock,
  ): ApiClient =>
    new ApiClient({
      baseUrl: "https://example.com/",
      getKeypair: () => keypair,
      ...(onAuthExpired ? { onAuthExpired } : {}),
    });

  it("prepends the base URL and signs with the device keypair", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const client = makeClient();

    const out = await client.json<{ ok: boolean }>("/api/me", {
      method: "POST",
    });

    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/example\.com\/api\/me\?ts=\d+$/);
    const headers = new Headers(init?.headers);
    const auth = headers.get("Authorization");
    expect(auth).not.toBeNull();
    expect(auth?.startsWith("Bearer ")).toBe(true);
    // The header format is `Bearer <wirePub>:<sig>` — both halves are base64.
    expect(auth?.split(" ")[1].split(":")).toHaveLength(2);
  });

  it("omits the Authorization header when the keypair is unavailable", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const client = makeClient(null);
    await client.fetch("/api/me");
    const init = fetchMock.mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("sets Content-Type: application/json for POST with a string body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const client = makeClient();
    await client.fetch("/api/v1/chat/abc", {
      method: "POST",
      body: JSON.stringify({ prompt: "hi" }),
    });

    const init = fetchMock.mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not override an explicit Content-Type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const client = makeClient();
    await client.fetch("/api/v1/upload", {
      method: "POST",
      body: "raw",
      headers: { "Content-Type": "text/plain" },
    });

    const init = fetchMock.mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("text/plain");
  });

  it("throws AuthRequiredError with signin_url on 401 and notifies onAuthExpired", async () => {
    // Seed the same 401 twice — the test makes two requests to assert both the shape (toMatchObject) and the prototype (instanceof) of the error.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { signin_url: "https://ollama.com/connect?x=1" }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { signin_url: "https://ollama.com/connect?x=1" }),
    );
    const onAuthExpired = jest.fn();
    const client = makeClient(makeKeypair(), onAuthExpired);

    await expect(
      client.json("/api/me", { method: "POST" }),
    ).rejects.toMatchObject({
      name: "AuthRequiredError",
      signinUrl: "https://ollama.com/connect?x=1",
    });
    expect(onAuthExpired).toHaveBeenCalledWith(
      "https://ollama.com/connect?x=1",
    );

    const err = await client
      .json("/api/me", { method: "POST" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthRequiredError);
  });

  it("throws CloudAPIError with retryAfter on 429", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: "slow down" }, { "Retry-After": "7" }),
    );
    const client = makeClient();
    const err = await client.fetch("/api/v1/chats").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudAPIError);
    expect(err).toMatchObject({
      status: 429,
      code: "rate_limited",
      retryAfter: 7,
    });
  });

  it("throws CloudAPIError(quota_exceeded) on 402", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(402, { message: "no $" }));
    const client = makeClient();
    const err = await client.fetch("/api/v1/chats").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudAPIError);
    expect(err).toMatchObject({ status: 402, code: "quota_exceeded" });
  });

  it("respects body `code: quota_exceeded` even on a non-402 status", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { code: "quota_exceeded", message: "hit cap" }),
    );
    const client = makeClient();
    const err = await client.fetch("/api/v1/chats").catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 400, code: "quota_exceeded" });
  });

  it("throws CloudAPIError(model_not_found) on body discriminator", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { code: "model_not_found", error: "no model" }),
    );
    const client = makeClient();
    const err = await client
      .fetch("/api/show", { method: "POST" })
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 404, code: "model_not_found" });
  });

  it("throws CloudAPIError(subscription_required) when 403 message mentions subscription", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, {
        message:
          "this model requires a subscription, upgrade for access: https://ollama.com/upgrade",
      }),
    );
    const client = makeClient();
    const err = await client.fetch("/api/v1/chats").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudAPIError);
    expect(err).toMatchObject({ status: 403, code: "subscription_required" });
  });

  it("falls through to unknown on 403 without subscription keyword", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { message: "forbidden" }),
    );
    const client = makeClient();
    const err = await client.fetch("/api/v1/chats").catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 403, code: "unknown" });
  });

  it("throws CloudAPIError(unknown) for 5xx", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: "down" }));
    const client = makeClient();
    const err = await client.fetch("/api/v1/chats").catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 503, code: "unknown" });
  });

  it("translates a fetch TypeError into NetworkError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    const client = makeClient();
    const err = await client.fetch("/api/v1/chats").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkError);
  });

  it("propagates non-TypeError fetch rejections unchanged", async () => {
    const abort = new DOMException("aborted", "AbortError");
    fetchMock.mockRejectedValueOnce(abort);
    const client = makeClient();
    const err = await client.fetch("/api/v1/chats").catch((e: unknown) => e);
    expect(err).toBe(abort);
  });

  it("returns the raw Response for stream()", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode("{}\n"));
        c.close();
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const client = makeClient();
    const controller = new AbortController();
    const res = await client.stream(
      "/api/v1/chat/x",
      { method: "POST", body: "{}" },
      controller.signal,
    );
    expect(res.status).toBe(200);
    expect(res.body).not.toBeNull();
    // The signal we passed should reach fetch.
    const init = fetchMock.mock.calls[0][1];
    expect(init?.signal).toBe(controller.signal);
  });

  it("supports async getKeypair resolvers", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const client = new ApiClient({
      baseUrl: "https://example.com",
      getKeypair: async () => makeKeypair(),
    });
    await client.fetch("/api/me", { method: "POST" });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")?.startsWith("Bearer ")).toBe(true);
  });

  it("handles error responses with a non-JSON body without crashing", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>500</html>", { status: 500 }),
    );
    const client = makeClient();
    const err = await client.fetch("/api/v1/chats").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudAPIError);
    expect(err).toMatchObject({ status: 500, code: "unknown" });
  });
});
