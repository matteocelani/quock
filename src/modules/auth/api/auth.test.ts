import { __deriveKeypairFromSeedForTest, type Keypair } from "@/modules/auth/lib/keypair";
import { fetchCurrentUser, signOut } from "@/modules/auth/api/auth";
import { ApiClient } from "@/lib/api/client";

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit?]>;

function installFetchMock(): FetchMock {
  const m = jest.fn() as FetchMock;
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

const TEST_SEED = new Uint8Array(32).fill(7);
function makeKeypair(): Keypair {
  return __deriveKeypairFromSeedForTest(TEST_SEED);
}

function makeClient(): ApiClient {
  return new ApiClient({
    baseUrl: "https://example.com",
    getKeypair: () => makeKeypair(),
  });
}

describe("auth API", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  it("fetchCurrentUser returns a User on 200", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: "u1",
        email: "a@b.com",
        name: "Alice",
        avatarurl: "https://cdn/x.png",
      }),
    );
    const user = await fetchCurrentUser(makeClient());
    expect(user).not.toBeNull();
    expect(user?.id).toBe("u1");
    expect(user?.email).toBe("a@b.com");
    expect(user?.avatarurl).toBe("https://cdn/x.png");
  });

  it("fetchCurrentUser rewrites relative avatar URLs", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: "u2",
        email: "a@b.com",
        name: "Alice",
        avatarurl: "/avatars/x.png",
      }),
    );
    const user = await fetchCurrentUser(makeClient());
    expect(user?.avatarurl).toBe("https://ollama.com/avatars/x.png");
  });

  it("fetchCurrentUser returns null on 401", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { signin_url: "https://ollama.com/connect" }),
    );
    const user = await fetchCurrentUser(makeClient());
    expect(user).toBeNull();
  });

  it("fetchCurrentUser propagates non-auth errors", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));
    await expect(fetchCurrentUser(makeClient())).rejects.toMatchObject({
      name: "CloudAPIError",
      status: 500,
    });
  });

  it("signOut POSTs to /api/signout", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await signOut(makeClient());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/example\.com\/api\/signout\?ts=\d+$/);
    expect(init?.method).toBe("POST");
  });

  it("signOut propagates errors as CloudAPIError", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: "down" }));
    await expect(signOut(makeClient())).rejects.toMatchObject({
      name: "CloudAPIError",
      status: 503,
    });
  });
});
