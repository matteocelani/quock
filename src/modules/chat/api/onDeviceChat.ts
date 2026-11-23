// The on-device twin of `sendChatMessage`: the same `ChatEventUnion` stream, produced by an MLX model on the phone
// instead of `/api/chat`, so the pipeline, the message rows and the UI cannot tell which engine answered.

import { ChatEvent } from "@/gotypes";
import type { ChatEventUnion, WireChatMessage } from "@/modules/chat/api/chat";
import { ON_DEVICE_MAX_TOKENS } from "@/modules/chat/constants";
import {
  cancelOnDeviceGeneration,
  generateOnDevice,
  subscribeOnDeviceGeneration,
  type OnDeviceTurn,
} from "@/lib/onDevice/onDeviceLLM";

export interface OnDeviceSendOptions {
  messages: WireChatMessage[];
  model: string;
  think?: boolean;
  signal?: AbortSignal;
}

let requestCounter = 0;

// Images and tool turns have no meaning for a text-only local model: images are dropped, tool rounds never happen
// because no tools are offered, and an empty turn would only confuse the chat template.
export function toOnDeviceTurns(
  messages: readonly WireChatMessage[],
): OnDeviceTurn[] {
  return messages
    .filter(
      (m): m is WireChatMessage & { role: OnDeviceTurn["role"] } =>
        m.role === "system" || m.role === "user" || m.role === "assistant",
    )
    .filter((m) => m.content.length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
}

function abortError(): Error {
  const error = new Error("The on-device reply was stopped");
  error.name = "AbortError";
  return error;
}

export async function* sendOnDeviceChatMessage(
  opts: OnDeviceSendOptions,
): AsyncGenerator<ChatEventUnion> {
  if (opts.signal?.aborted) throw abortError();
  requestCounter += 1;
  const requestId = `local-${Date.now()}-${requestCounter}`;
  const queue: ChatEventUnion[] = [];
  let received = 0;
  let expected: number | null = null;
  let failure: unknown = null;
  let wake: (() => void) | null = null;
  const notify = (): void => {
    const resume = wake;
    wake = null;
    resume?.();
  };

  const subscription = subscribeOnDeviceGeneration(requestId, (event) => {
    received += 1;
    queue.push(
      event.kind === "thinking"
        ? new ChatEvent({ eventName: "thinking", thinking: event.text })
        : new ChatEvent({ eventName: "chat", content: event.text }),
    );
    notify();
  });
  const onAbort = (): void => {
    cancelOnDeviceGeneration(requestId).catch((err: unknown) => {
      console.warn("onDeviceChat: cancel failed", err);
    });
  };
  opts.signal?.addEventListener("abort", onAbort);

  generateOnDevice(
    requestId,
    opts.model,
    toOnDeviceTurns(opts.messages),
    opts.think,
    ON_DEVICE_MAX_TOKENS,
  ).then(
    (stats) => {
      expected = stats.events;
      notify();
    },
    (err: unknown) => {
      failure = err;
      notify();
    },
  );

  try {
    while (true) {
      const next = queue.shift();
      if (next) {
        yield next;
        continue;
      }
      if (failure !== null) {
        // A cancelled generation can surface as a native error; the user stopped it, so it is an abort, not a fault.
        if (opts.signal?.aborted) throw abortError();
        throw new Error("The on-device model failed", { cause: failure });
      }
      // The promise can settle before its last events cross the bridge; done means every emitted event arrived.
      if (expected !== null && received >= expected) break;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
    if (opts.signal?.aborted) throw abortError();
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    subscription.remove();
  }
}
