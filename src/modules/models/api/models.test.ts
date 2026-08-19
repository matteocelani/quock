import { ApiClient } from "@/lib/api/client";
import {
  fetchModelCapabilities,
  isCloudModelName,
  listCloudCatalogue,
  listCloudModels,
  mergeCloudModels,
  normalizeModelName,
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

  it("listCloudCatalogue takes the names out of the tags payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        models: [
          { name: "glm-5.2", size: 0, details: {} },
          { name: "gpt-oss:120b" },
          { size: 0 },
          { name: "" },
        ],
      }),
    );
    const out = await listCloudCatalogue(makeClient());
    expect(out).toEqual(["glm-5.2", "gpt-oss:120b"]);
  });

  it("listCloudCatalogue handles a missing models array gracefully", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    expect(await listCloudCatalogue(makeClient())).toEqual([]);
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

  it("normalizeModelName strips only a trailing cloud tag", () => {
    expect(normalizeModelName("glm-5.2:cloud")).toBe("glm-5.2");
    expect(normalizeModelName("glm-5.2")).toBe("glm-5.2");
    // Both spellings existed on the wire, and a pin saved under either has to keep resolving.
    expect(normalizeModelName("gpt-oss:120b-cloud")).toBe("gpt-oss:120b");
    // A size tag is part of the identity: gpt-oss:120b and gpt-oss:20b are different models.
    expect(normalizeModelName("gpt-oss:120b")).toBe("gpt-oss:120b");
  });

  it("mergeCloudModels puts the featured first and keeps their description", () => {
    const merged = mergeCloudModels(
      [
        { name: "glm-5.2:cloud", description: "Reasoning and code" },
        { name: "gemma4:26b", description: "Runs locally" },
      ],
      ["kimi-k3", "glm-5.2", "gpt-oss:120b"],
    );
    expect(merged.map((m) => m.name)).toEqual([
      "glm-5.2",
      "kimi-k3",
      "gpt-oss:120b",
    ]);
    expect(merged[0].description).toBe("Reasoning and code");
    expect(merged[1].description).toBeUndefined();
  });

  // The same model under two names must not become two rows.
  it("mergeCloudModels does not duplicate a featured model listed bare in the catalogue", () => {
    const merged = mergeCloudModels(
      [{ name: "minimax-m3:cloud" }],
      ["minimax-m3"],
    );
    expect(merged).toEqual([{ name: "minimax-m3", isRecommended: true }]);
  });

  // `/api/tags` answers in a different order on every call, so the flag — not the position — is what marks a ranking.
  it("mergeCloudModels marks only the recommended models", () => {
    const merged = mergeCloudModels(
      [{ name: "glm-5.2:cloud" }],
      ["kimi-k3", "glm-5.2"],
    );
    expect(
      merged.map((m) => [m.name, m.isRecommended === true] as const),
    ).toEqual([
      ["glm-5.2", true],
      ["kimi-k3", false],
    ]);
  });

  // A local recommendation cannot run on a phone, and the catalogue never lists one.
  it("mergeCloudModels drops local recommendations", () => {
    const merged = mergeCloudModels([{ name: "gemma4:26b" }], ["kimi-k3"]);
    expect(merged.map((m) => m.name)).toEqual(["kimi-k3"]);
  });

  // Losing the catalogue must degrade to what shipped before, never to an empty picker.
  it("mergeCloudModels falls back to the featured cloud subset without a catalogue", () => {
    const merged = mergeCloudModels(
      [{ name: "glm-5.2:cloud" }, { name: "gemma4:26b" }],
      [],
    );
    expect(merged).toEqual([{ name: "glm-5.2:cloud", isRecommended: true }]);
  });

  it("isCloudModelName classifies names by `cloud` suffix", () => {
    expect(isCloudModelName("gpt-oss:120b-cloud")).toBe(true);
    expect(isCloudModelName("qwen3:8b-cloud")).toBe(true);
    expect(isCloudModelName("llama3:8b")).toBe(false);
    expect(isCloudModelName("")).toBe(false);
  });
});
