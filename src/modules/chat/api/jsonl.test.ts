import { STREAM_READ_DEADLINE_MS } from "@/modules/chat/constants";
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

describe("parseJsonlStream idle deadline", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  // The failure this guards: a server that stops sending without closing leaves `read()` pending forever, and the
  // turn above it keeps its typing dots for the life of the process.
  it("gives up on a stream that goes silent", async () => {
    jest.useFakeTimers();
    // Never enqueues and never closes — a half-open socket as the reader sees it.
    const stalled = new ReadableStream<Uint8Array>({ pull() {} });
    const collected = collect(parseJsonlStream<unknown>(stalled));
    const settled = expect(collected).rejects.toThrow(/Network request failed/);

    await jest.advanceTimersByTimeAsync(STREAM_READ_DEADLINE_MS + 1);

    await settled;
  });

  // A long answer is legitimately slow; only the gap between chunks may trip the deadline, never the total.
  it("keeps reading while chunks arrive inside the window", async () => {
    jest.useFakeTimers();
    const encoder = new TextEncoder();
    let sent = 0;
    const drip = new ReadableStream<Uint8Array>({
      async pull(controller) {
        // The gap is the point: each chunk lands just before the deadline, so the run outlives it several times over
        // without ever being silent for long enough to trip it.
        await new Promise((resolve) => {
          setTimeout(resolve, STREAM_READ_DEADLINE_MS - 1);
        });
        if (sent === 3) {
          controller.close();
          return;
        }
        sent += 1;
        controller.enqueue(encoder.encode(`{"n":${sent}}\n`));
      },
    });
    const collected = collect(parseJsonlStream<{ n: number }>(drip));

    await jest.advanceTimersByTimeAsync(STREAM_READ_DEADLINE_MS * 4);

    expect(await collected).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });
});
