import type { GenerateEvent, OnDeviceStats } from "@/lib/onDevice/onDeviceLLM";
import {
  sendOnDeviceChatMessage,
  toOnDeviceTurns,
} from "@/modules/chat/api/onDeviceChat";

type Listener = (event: GenerateEvent) => void;
const listeners: Listener[] = [];
let mockGenerate: (requestId: string) => Promise<OnDeviceStats>;

jest.mock("@/lib/onDevice/onDeviceLLM", () => ({
  subscribeOnDeviceGeneration: (
    requestId: string,
    listener: Listener,
  ): { remove: () => void } => {
    const scoped: Listener = (event) => {
      if (event.requestId === requestId) listener(event);
    };
    listeners.push(scoped);
    return {
      remove: (): void => {
        listeners.splice(listeners.indexOf(scoped), 1);
      },
    };
  },
  generateOnDevice: (requestId: string): Promise<OnDeviceStats> =>
    mockGenerate(requestId),
  cancelOnDeviceGeneration: (): Promise<void> => Promise.resolve(),
}));

function emit(event: GenerateEvent): void {
  listeners.forEach((listener) => listener(event));
}

function stats(
  events: number,
  stopReason: OnDeviceStats["stopReason"],
): OnDeviceStats {
  return {
    promptTokens: 1,
    generatedTokens: events,
    tokensPerSecond: 1,
    loadSeconds: 0,
    peakMemoryBytes: 0,
    events,
    stopReason,
  };
}

async function collect(
  stream: AsyncGenerator<unknown>,
): Promise<{ events: unknown[]; error: unknown }> {
  const events: unknown[] = [];
  try {
    for await (const event of stream) events.push(event);
    return { events, error: null };
  } catch (error) {
    return { events, error };
  }
}

describe("sendOnDeviceChatMessage", () => {
  it("waits for tokens that cross the bridge after the reply promise settles", async () => {
    mockGenerate = (requestId): Promise<OnDeviceStats> => {
      emit({ requestId, kind: "thinking", text: "hm" });
      // The promise settles first; the answer token arrives on the next tick.
      setTimeout(() => emit({ requestId, kind: "content", text: "Ciao" }), 0);
      return Promise.resolve(stats(2, "complete"));
    };
    const result = await collect(
      sendOnDeviceChatMessage({
        messages: [{ role: "user", content: "hi" }],
        model: "qwen3.5:0.8b-mlx",
      }),
    );
    expect(result.error).toBeNull();
    expect(result.events).toEqual([
      expect.objectContaining({ eventName: "thinking", thinking: "hm" }),
      expect.objectContaining({ eventName: "chat", content: "Ciao" }),
    ]);
  });

  it("ends a reply cut short by the app leaving the foreground as an interruption", async () => {
    mockGenerate = (requestId): Promise<OnDeviceStats> => {
      emit({ requestId, kind: "content", text: "Una parte" });
      return Promise.resolve(stats(1, "inactive"));
    };
    const result = await collect(
      sendOnDeviceChatMessage({
        messages: [{ role: "user", content: "hi" }],
        model: "qwen3.5:0.8b-mlx",
      }),
    );
    expect(result.events).toHaveLength(1);
    expect(result.error).toEqual(
      expect.objectContaining({ name: "AbortError" }),
    );
  });

  it("reports a native failure as an error, not as an interruption", async () => {
    mockGenerate = (): Promise<OnDeviceStats> =>
      Promise.reject(new Error("GPU refused"));
    const result = await collect(
      sendOnDeviceChatMessage({
        messages: [{ role: "user", content: "hi" }],
        model: "qwen3.5:0.8b-mlx",
      }),
    );
    expect(result.error).toEqual(
      expect.objectContaining({ message: "The on-device model failed" }),
    );
  });
});

describe("toOnDeviceTurns", () => {
  it("keeps the conversation and drops what a local text model cannot use", () => {
    expect(
      toOnDeviceTurns([
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hi", images: ["aGVsbG8="] },
        { role: "assistant", content: "" },
        { role: "tool", content: "result", tool_name: "web_search" },
        { role: "assistant", content: "Hello!" },
      ]),
    ).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);
  });
});
