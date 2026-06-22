import { ApiClient } from "@/lib/api/client";
import {
  fetchModelCapabilities,
  isCloudModelName,
  listCloudModels,
} from "@/modules/models/api/models";

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

describe("models API", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  it("listCloudModels maps the recommendations payload into CloudModel[]", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        recommendations: [
          { model: "gpt-oss:120b-cloud", description: "Big" },
          { model: "qwen3:8b-cloud" },
          { description: "no model, should be filtered" },
        ],
      }),
    );
    const out = await listCloudModels(makeClient());
    expect(out).toEqual([
      { name: "gpt-oss:120b-cloud", description: "Big" },
      { name: "qwen3:8b-cloud" },
    ]);
  });

  it("listCloudModels handles a missing recommendations array gracefully", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const out = await listCloudModels(makeClient());
    expect(out).toEqual([]);
  });

  it("fetchModelCapabilities POSTs to /api/show with the model name", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { capabilities: ["vision"] }),
    );
    const caps = await fetchModelCapabilities(
      makeClient(),
      "gpt-oss:120b-cloud",
    );
    expect(caps).toEqual(["vision"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/api/show");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      model: "gpt-oss:120b-cloud",
    });
  });

  it("fetchModelCapabilities returns [] when the server omits the field", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const caps = await fetchModelCapabilities(
      makeClient(),
      "gpt-oss:120b-cloud",
    );
    expect(caps).toEqual([]);
  });

  it("isCloudModelName classifies names by `cloud` suffix", () => {
    expect(isCloudModelName("gpt-oss:120b-cloud")).toBe(true);
    expect(isCloudModelName("qwen3:8b-cloud")).toBe(true);
    expect(isCloudModelName("llama3:8b")).toBe(false);
    expect(isCloudModelName("")).toBe(false);
  });
});
