import { sendChatMessage } from "@/modules/chat/api/chat";
import { ApiClient } from "@/lib/api/client";

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit?]>;

function installFetchMock(): FetchMock {
  const m = jest.fn() as FetchMock;
  (globalThis as { fetch: typeof fetch }).fetch = m as unknown as typeof fetch;
  return m;
}

function streamResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

// `void value` keeps `noUnusedLocals` quiet while we drain to completion.
async function drain(gen: AsyncGenerator<unknown>): Promise<void> {
  for await (const value of gen) {
    void value;
  }
}

function makeClient(): ApiClient {
  // Tests don't exercise the signed-request path; null skips signing entirely.
  return new ApiClient({
    baseUrl: "https://example.com",
    getKeypair: () => null,
  });
}

describe("chat API", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  it("sendChatMessage maps Ollama JSONL chunks into ChatEvent emissions", async () => {
    fetchMock.mockResolvedValueOnce(
      streamResponse([
        `{"model":"gpt-oss:120b-cloud","message":{"role":"assistant","content":"Hel"},"done":false}\n`,
        `{"model":"gpt-oss:120b-cloud","message":{"role":"assistant","content":"lo"},"done":false}\n`,
        `{"model":"gpt-oss:120b-cloud","message":{"role":"assistant","content":""},"done":true}\n`,
      ]),
    );

    const events: { eventName: string; content?: string }[] = [];
    for await (const ev of sendChatMessage(makeClient(), {
      chatId: "c1",
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-oss:120b-cloud",
    })) {
      events.push({
        eventName: ev.eventName,
        content: (ev as { content?: string }).content,
      });
    }

    expect(events).toEqual([
      { eventName: "chat", content: "Hel" },
      { eventName: "chat", content: "lo" },
    ]);
  });

  it("emits both thinking and content when a single chunk carries both (no dropped first token)", async () => {
    fetchMock.mockResolvedValueOnce(
      streamResponse([
        `{"message":{"role":"assistant","thinking":"reasoning"},"done":false}\n`,
        // Transition chunk: last reasoning delta + first answer token together.
        `{"message":{"role":"assistant","thinking":" more","content":"Piacere"},"done":false}\n`,
        `{"message":{"role":"assistant","content":" di conoscerti"},"done":false}\n`,
        `{"message":{"role":"assistant","content":""},"done":true}\n`,
      ]),
    );

    const events: { eventName: string; content?: string; thinking?: string }[] =
      [];
    for await (const ev of sendChatMessage(makeClient(), {
      chatId: "c1",
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-oss:120b-cloud",
    })) {
      events.push({
        eventName: ev.eventName,
        content: (ev as { content?: string }).content,
        thinking: (ev as { thinking?: string }).thinking,
      });
    }

    expect(events).toEqual([
      { eventName: "thinking", content: undefined, thinking: "reasoning" },
      { eventName: "thinking", content: undefined, thinking: " more" },
      { eventName: "chat", content: "Piacere", thinking: undefined },
      { eventName: "chat", content: " di conoscerti", thinking: undefined },
    ]);
  });

  it("sendChatMessage POSTs to /api/chat with the standard Ollama body", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse([`{"done":true}\n`]));

    await drain(
      sendChatMessage(makeClient(), {
        chatId: "c1",
        messages: [
          { role: "user", content: "first" },
          { role: "assistant", content: "hi" },
          { role: "user", content: "again" },
        ],
        model: "gpt-oss:120b-cloud",
      }),
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/api/chat");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string) as {
      model: string;
      messages: { role: string; content: string }[];
      stream: boolean;
    };
    expect(body.model).toBe("gpt-oss:120b-cloud");
    expect(body.stream).toBe(true);
    expect(body.messages).toHaveLength(3);
    expect(body.messages[2]).toEqual({ role: "user", content: "again" });
  });

  it("sendChatMessage encodes image attachments onto the last user message", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse([`{"done":true}\n`]));

    const data = new Uint8Array([1, 2, 3, 4]);
    await drain(
      sendChatMessage(makeClient(), {
        chatId: "c1",
        messages: [{ role: "user", content: "look" }],
        model: "gpt-oss:120b-cloud",
        attachments: [{ filename: "a.png", data, mimeType: "image/png" }],
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      messages: { role: string; content: string; images?: string[] }[];
    };
    // base64("\x01\x02\x03\x04") === "AQIDBA=="
    expect(body.messages[0].images).toEqual(["AQIDBA=="]);
  });

  it("sendChatMessage forwards an AbortSignal to fetch", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse([`{"done":true}\n`]));
    const controller = new AbortController();
    await drain(
      sendChatMessage(makeClient(), {
        chatId: "c1",
        messages: [{ role: "user", content: "hi" }],
        model: "gpt-oss:120b-cloud",
        signal: controller.signal,
      }),
    );
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});
