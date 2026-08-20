import { ApiClient } from "@/lib/api/client";
import { fetchCloudModelList } from "@/modules/models/lib/cloudModelList";

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit?]>;

function installFetchMock(): FetchMock {
  const m = jest.fn() as FetchMock;
  (globalThis as { fetch: typeof fetch }).fetch = m as unknown as typeof fetch;
  return m;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeClient(): ApiClient {
  // Tests don't exercise the signed-request path; null skips signing entirely.
  return new ApiClient({
    baseUrl: "https://example.com",
    getKeypair: () => null,
  });
}

const RECOMMENDED = { recommendations: [{ model: "glm-5.2:cloud" }] };
const CATALOGUE = { models: [{ name: "glm-5.2" }, { name: "kimi-k3" }] };

describe("fetchCloudModelList", () => {
  let fetchMock: FetchMock;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = installFetchMock();
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  // The whole point of the change: awaiting one before starting the other cost a round-trip on every cold launch.
  it("puts both requests in flight before either resolves", async () => {
    const started: string[] = [];
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async (url: string) => {
      started.push(url.includes("/api/tags") ? "catalogue" : "recommendations");
      // Hold the first response open; were the calls sequential the second would never start.
      await gate;
      return jsonResponse(
        200,
        url.includes("/api/tags") ? CATALOGUE : RECOMMENDED,
      );
    });

    const pending = fetchCloudModelList(makeClient());
    // A macrotask boundary, not one tick: the client resolves its keypair before it reaches fetch.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started.sort()).toEqual(["catalogue", "recommendations"]);

    release();
    const models = await pending;
    expect(models.map((m) => m.name)).toEqual(["glm-5.2", "kimi-k3"]);
  });

  it("keeps the featured list when the catalogue fails", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/api/tags")
        ? jsonResponse(500, { error: "down" })
        : jsonResponse(200, RECOMMENDED),
    );

    const models = await fetchCloudModelList(makeClient());

    expect(models.map((m) => m.name)).toEqual(["glm-5.2:cloud"]);
  });

  // The claim the concurrency rests on: only the catalogue is allowed to fail quietly.
  it("fails the whole read when the recommendations fail", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/api/tags")
        ? jsonResponse(200, CATALOGUE)
        : jsonResponse(500, { error: "down" }),
    );

    await expect(fetchCloudModelList(makeClient())).rejects.toThrow();
  });
});
