import type { ApiClient } from "@/lib/api/client";
import type { DbMemoryFact } from "@/lib/db/types";
import { asFactId, type FactId } from "@/lib/types/ids";
import { MEMORY_MAX_FACTS } from "@/modules/chat/constants";
import {
  MEMORY_REPLIES,
  type MemoryTurnState,
} from "@/modules/chat/lib/memoryGate";
import {
  chooseTools,
  executeMemoryCall,
  executeToolCall,
  forgetIdsArg,
  isMemoryToolCall,
  MEMORY_TOOLS,
  type MemoryStore,
  WEB_TOOLS,
  type WireToolCall,
} from "@/modules/chat/lib/tools";
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

describe("chooseTools", () => {
  it("sends no tools when neither web search nor memory is on", () => {
    expect(chooseTools(false, false)).toBeUndefined();
  });

  it("keeps a web-only request identical to before memory existed", () => {
    expect(chooseTools(true, false)).toEqual(WEB_TOOLS);
  });

  it("offers the memory tools alone, or after the web tools", () => {
    expect(chooseTools(false, true)).toEqual(MEMORY_TOOLS);
    expect(chooseTools(true, true)).toEqual([...WEB_TOOLS, ...MEMORY_TOOLS]);
  });
});

describe("isMemoryToolCall", () => {
  it("tells memory calls apart from web calls", () => {
    expect(isMemoryToolCall(call("remember_fact", { fact: "x" }))).toBe(true);
    expect(isMemoryToolCall(call("forget_fact", { ids: [1] }))).toBe(true);
    expect(isMemoryToolCall(call("web_search", { query: "x" }))).toBe(false);
  });
});

describe("forgetIdsArg", () => {
  it("takes every shape a model sends ids in", () => {
    expect(forgetIdsArg(call("forget_fact", { ids: [1, 2] }))).toEqual([1, 2]);
    expect(forgetIdsArg(call("forget_fact", { ids: 3 }))).toEqual([3]);
    expect(forgetIdsArg(call("forget_fact", { ids: "4" }))).toEqual(["4"]);
    expect(forgetIdsArg(call("forget_fact", { ids: "[5,6]" }))).toEqual([5, 6]);
    expect(forgetIdsArg(call("forget_fact", { id: 7 }))).toEqual([7]);
    expect(forgetIdsArg(call("forget_fact", {}))).toEqual([]);
  });
});

interface FakeStore {
  store: MemoryStore;
  add: jest.Mock;
  remove: jest.Mock;
  list: jest.Mock;
}

describe("executeMemoryCall", () => {
  const CLEAN: MemoryTurnState = {
    hasUntrustedContext: false,
    hasRunWebTool: false,
    savedThisTurn: 0,
  };

  // An in-memory stand-in for MemoryRepository, since SQLite does not run under Jest.
  function fakeStore(initial: readonly string[]): FakeStore {
    let rows: DbMemoryFact[] = initial.map((content, i) => ({
      id: asFactId(i + 1),
      content,
      createdAt: i + 1,
    }));
    let nextId = rows.length + 1;
    const list = jest.fn(async (): Promise<DbMemoryFact[]> => [...rows]);
    const add = jest.fn(async (content: string): Promise<DbMemoryFact> => {
      const row = { id: asFactId(nextId), content, createdAt: nextId };
      nextId += 1;
      rows = [...rows, row];
      return row;
    });
    const remove = jest.fn(async (id: FactId): Promise<boolean> => {
      const before = rows.length;
      rows = rows.filter((r) => r.id !== id);
      return rows.length < before;
    });
    return { store: { list, add, remove }, add, remove, list };
  }

  it("saves an accepted fact with the cap and reports its id", async () => {
    const { store, add } = fakeStore(["Name is Matteo"]);

    const out = await executeMemoryCall(
      store,
      call("remember_fact", { fact: "Likes tea" }),
      CLEAN,
    );

    expect(add).toHaveBeenCalledWith("Likes tea", MEMORY_MAX_FACTS);
    expect(out).toEqual({ result: "Saved as id 2.", hasSaved: true });
  });

  it("never writes a duplicate", async () => {
    const { store, add } = fakeStore(["Likes tea"]);

    const out = await executeMemoryCall(
      store,
      call("remember_fact", { fact: "likes tea." }),
      CLEAN,
    );

    expect(add).not.toHaveBeenCalled();
    expect(out.hasSaved).toBe(false);
  });

  it("removes the ids it knows and names the ones it does not", async () => {
    const { store, remove } = fakeStore(["Likes tea"]);

    const out = await executeMemoryCall(
      store,
      call("forget_fact", { ids: [1, 99] }),
      CLEAN,
    );

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(1);
    expect(out.result).toBe(
      "Removed id 1. Not removed: there is no fact with id 99.",
    );
  });

  it("refuses a read-only forget once, not once per id", async () => {
    const { store, remove } = fakeStore(["Likes tea", "Name is Matteo"]);

    const out = await executeMemoryCall(
      store,
      call("forget_fact", { ids: [1, 2] }),
      { ...CLEAN, hasRunWebTool: true },
    );

    expect(remove).not.toHaveBeenCalled();
    expect(out.result).toBe(MEMORY_REPLIES.forgetReadOnly);
  });

  it("turns a storage failure into a tool result instead of throwing", async () => {
    const { store, list } = fakeStore([]);
    list.mockRejectedValue(new Error("disk I/O error"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const out = await executeMemoryCall(
      store,
      call("remember_fact", { fact: "Likes tea" }),
      CLEAN,
    );

    expect(out).toEqual({
      result: MEMORY_REPLIES.unavailable,
      hasSaved: false,
    });
    warnSpy.mockRestore();
  });
});
