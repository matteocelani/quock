// JSONL streaming parser. Malformed JSON throws (caller maps it to StreamInterruptedError); the standalone `parseJsonlStream` overload lets tests skip building a fake Response.

import { NetworkError } from "@/lib/api/errors";
import { STREAM_READ_DEADLINE_MS } from "@/modules/chat/constants";

// A half-open socket — the server stops sending without closing — leaves `read()` pending forever, and with it the
// whole turn. Reported as a network failure because that is what it is from here.
async function readBeforeIdle(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const idle = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      // Rejected before the cancel, not after: cancelling resolves the pending read, and whichever settles first
      // wins the race — so the other order ends the stream as a clean close instead of the failure it is.
      reject(
        new NetworkError(new Error(`No data for ${STREAM_READ_DEADLINE_MS}ms`)),
      );
      reader.cancel().catch((err: unknown) => {
        console.warn("parseJsonlStream: could not cancel an idle stream", err);
      });
    }, STREAM_READ_DEADLINE_MS);
  });
  try {
    return await Promise.race([reader.read(), idle]);
  } finally {
    clearTimeout(timer);
  }
}

// Buffers across chunk boundaries so multi-byte UTF-8 and partial JSON lines survive.
export async function* parseJsonlStream<T>(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<T, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await readBeforeIdle(reader);

      if (done) {
        // Flush any trailing split multi-byte sequence held in the decoder.
        buffer += decoder.decode();
        const trailing = buffer.trim();
        if (trailing) {
          yield parseLine<T>(trailing);
        }
        break;
      }

      // `stream: true` keeps split multi-byte sequences instead of emitting a replacement char.
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      // Last element may be an incomplete line; carry it into the next iteration.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          yield parseLine<T>(trimmed);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Matches the web app's signature.
export async function* parseJsonlFromResponse<T>(
  response: Response,
): AsyncGenerator<T, void, unknown> {
  if (!response.body) {
    throw new Error("Response body is null");
  }
  yield* parseJsonlStream<T>(response.body);
}

function parseLine<T>(line: string): T {
  try {
    return JSON.parse(line) as T;
  } catch (cause) {
    throw new Error(`Failed to parse JSONL line: ${line}`, { cause });
  }
}
