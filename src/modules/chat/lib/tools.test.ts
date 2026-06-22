import type { ApiClient } from "@/lib/api/client";
import { executeToolCall, type WireToolCall } from "@/modules/chat/lib/tools";
import { webFetch, webSearch } from "@/modules/chat/api/webSearch";

jest.mock("@/modules/chat/api/webSearch", () => ({
  webSearch: jest.fn(),
  webFetch: jest.fn(),
}));

const mockWebSearch = webSearch as jest.MockedFunction<typeof webSearch>;
const mockWebFetch = webFetch as jest.MockedFunction<typeof webFetch>;

// The client is opaque here — executeToolCall only forwards it to the (mocked) API helpers.
const client = { id: "sentinel" } as unknown as ApiClient;

function call(name: string, args: Record<string, unknown>): WireToolCall {
  return { function: { name, arguments: args } };
}

describe("executeToolCall", () => {
  beforeEach(() => {
    mockWebSearch.mockReset();
    mockWebFetch.mockReset();
  });

  it("routes web_search to webSearch and serializes the result list", async () => {
    const results = [{ title: "T", url: "https://x", content: "body" }];
    mockWebSearch.mockResolvedValue(results);

    const out = await executeToolCall(client, call("web_search", { query: "rust async" }));

    expect(mockWebSearch).toHaveBeenCalledWith(client, "rust async");
    expect(mockWebFetch).not.toHaveBeenCalled();
    expect(out).toBe(JSON.stringify(results));
  });

  it("routes web_fetch to webFetch and serializes the page result", async () => {
    const page = { title: "Page", content: "readable", links: ["https://a"] };
    mockWebFetch.mockResolvedValue(page);

    const out = await executeToolCall(client, call("web_fetch", { url: "https://example.com" }));

    expect(mockWebFetch).toHaveBeenCalledWith(client, "https://example.com");
    expect(mockWebSearch).not.toHaveBeenCalled();
    expect(out).toBe(JSON.stringify(page));
  });

  it("falls back to an empty string when the argument is missing or mistyped", async () => {
    mockWebSearch.mockResolvedValue([]);

    await executeToolCall(client, call("web_search", {}));
    expect(mockWebSearch).toHaveBeenLastCalledWith(client, "");

    await executeToolCall(client, call("web_search", { query: 42 }));
    expect(mockWebSearch).toHaveBeenLastCalledWith(client, "");
  });

  it("returns a not-available message for an unknown tool without touching the API", async () => {
    const out = await executeToolCall(client, call("delete_everything", {}));

    expect(out).toBe("Tool delete_everything is not available.");
    expect(mockWebSearch).not.toHaveBeenCalled();
    expect(mockWebFetch).not.toHaveBeenCalled();
  });
});
