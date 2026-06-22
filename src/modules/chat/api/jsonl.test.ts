import { parseJsonlFromResponse, parseJsonlStream } from "@/modules/chat/api/jsonl";

// One chunk per `read()` call so chunk-boundary buffering is exercised deterministically.
function streamFromChunks(
  chunks: (Uint8Array | string)[],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const queue: Uint8Array[] = chunks.map((c) =>
    typeof c === "string" ? encoder.encode(c) : c,
  );
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = queue.shift();
      if (next === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(next);
    },
  });
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) {
    out.push(v);
  }
  return out;
}

describe("parseJsonlStream", () => {
  it("parses a single complete line", async () => {
    const stream = streamFromChunks([`{"a":1}\n`]);
    const events = await collect(parseJsonlStream<{ a: number }>(stream));
    expect(events).toEqual([{ a: 1 }]);
  });

  it("parses multiple lines in a single chunk", async () => {
    const stream = streamFromChunks([`{"a":1}\n{"a":2}\n{"a":3}\n`]);
    const events = await collect(parseJsonlStream<{ a: number }>(stream));
    expect(events).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it("buffers a line split across chunks", async () => {
    const stream = streamFromChunks([`{"a":`, `123}\n`]);
    const events = await collect(parseJsonlStream<{ a: number }>(stream));
    expect(events).toEqual([{ a: 123 }]);
  });

  it("ignores empty and whitespace-only lines", async () => {
    const stream = streamFromChunks([`{"a":1}\n\n   \n{"a":2}\n`]);
    const events = await collect(parseJsonlStream<{ a: number }>(stream));
    expect(events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("flushes a trailing line that has no newline terminator", async () => {
    const stream = streamFromChunks([`{"a":1}\n{"a":2}`]);
    const events = await collect(parseJsonlStream<{ a: number }>(stream));
    expect(events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("throws with the offending line text when JSON is malformed", async () => {
    const stream = streamFromChunks([`{"a":1}\nnot-json\n`]);
    const gen = parseJsonlStream<{ a: number }>(stream);
    await expect(collect(gen)).rejects.toThrow(/not-json/);
  });

  it("handles UTF-8 multi-byte characters split across chunks", async () => {
    // Split `💪` (F0 9F 92 AA) between bytes 2 and 3 to force decoder buffering.
    const fullLine = `{"msg":"hi 💪"}\n`;
    const encoded = new TextEncoder().encode(fullLine);
    const splitAt = encoded.findIndex((b) => b === 0xf0) + 2;
    const part1 = encoded.subarray(0, splitAt);
    const part2 = encoded.subarray(splitAt);
    const stream = streamFromChunks([part1, part2]);
    const events = await collect(parseJsonlStream<{ msg: string }>(stream));
    expect(events).toEqual([{ msg: "hi 💪" }]);
  });
});

describe("parseJsonlFromResponse", () => {
  it("yields events from a Response body", async () => {
    const body = streamFromChunks([`{"a":1}\n{"a":2}\n`]);
    const response = new Response(body);
    const events = await collect(
      parseJsonlFromResponse<{ a: number }>(response),
    );
    expect(events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("throws when the response body is null", async () => {
    const response = { body: null } as unknown as Response;
    await expect(
      collect(parseJsonlFromResponse<unknown>(response)),
    ).rejects.toThrow(/null/);
  });
});
