import { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/lib/api/client";
import type { MessageRepository } from "@/lib/db/messageRepository";
import { queryKeys } from "@/lib/hooks/queryKeys";
import type { UseHapticsResult } from "@/lib/hooks/useHaptics";
import { asChatId, asMessageId } from "@/lib/types/ids";
import {
  type ChatEventUnion,
  sendChatMessage,
  type WireChatMessage,
} from "@/modules/chat/api/chat";
import { WEB_SEARCH_MAX_TOOL_ROUNDS } from "@/modules/chat/constants";
import type { UseChatData } from "@/modules/chat/hooks/useChat";
import {
  type RunStreamContext,
  runStream,
} from "@/modules/chat/lib/streamPipeline";
import { executeToolCall, type WireToolCall } from "@/modules/chat/lib/tools";

// The pipeline pulls turns off this generator and runs tool calls through this fn; both are stubbed.
jest.mock("@/modules/chat/api/chat", () => ({ sendChatMessage: jest.fn() }));
jest.mock("@/modules/chat/lib/tools", () => ({ executeToolCall: jest.fn() }));

const mockSendChat = sendChatMessage as jest.MockedFunction<typeof sendChatMessage>;
const mockExecuteTool = executeToolCall as jest.MockedFunction<typeof executeToolCall>;

const CHAT_ID = asChatId("chat-1");
const ASSISTANT_ID = asMessageId(1);

function chatEvent(content: string): ChatEventUnion {
  return { eventName: "chat", content } as ChatEventUnion;
}

function toolCallsEvent(calls: WireToolCall[]): ChatEventUnion {
  return { eventName: "tool_calls", toolCalls: calls } as ChatEventUnion;
}

function wsCall(query: string): WireToolCall {
  return { function: { name: "web_search", arguments: { query } } };
}

// Scripts sendChatMessage to yield one event-array per round (round N -> turns[N], then empty = a turn with no tool calls).
function scriptTurns(turns: ChatEventUnion[][]): void {
  let round = 0;
  mockSendChat.mockImplementation(async function* () {
    const events = turns[round] ?? [];
    round += 1;
    for (const ev of events) yield ev;
  });
}

function makeCtx() {
  // gcTime Infinity keeps the cache from scheduling a gc timer that would outlive the test (open handle).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.chat(CHAT_ID), {
    chat: { id: CHAT_ID },
    messages: [
      {
        id: ASSISTANT_ID,
        chatId: CHAT_ID,
        role: "assistant",
        content: "",
        thinking: null,
        status: "pending",
        errorCode: null,
        webSearchFailed: false,
        createdAt: 0,
        updatedAt: 0,
      },
    ],
    attachmentsByMessage: new Map(),
  } as unknown as UseChatData);

  const update = jest.fn().mockResolvedValue(undefined);
  const setToolActivity = jest.fn();
  const endStream = jest.fn();
  const light = jest.fn();

  const ctx: RunStreamContext = {
    client: {} as ApiClient,
    chatId: CHAT_ID,
    messages: { update } as unknown as MessageRepository,
    queryClient,
    startStream: jest.fn(),
    endStream,
    updateProgress: jest.fn(),
    setToolActivity,
    haptics: { light } as unknown as UseHapticsResult,
    controllerRef: { current: null as AbortController | null },
  };

  return { ctx, queryClient, update, setToolActivity, endStream, light };
}

function tailMessage(queryClient: QueryClient) {
  const data = queryClient.getQueryData<UseChatData>(queryKeys.chat(CHAT_ID));
  const list = data?.messages ?? [];
  return list[list.length - 1] as {
    content: string;
    status: string;
    webSearchFailed: boolean;
  };
}

const USER_MESSAGES: WireChatMessage[] = [{ role: "user", content: "hi" }];

function run(ctx: RunStreamContext): Promise<void> {
  return runStream(ctx, "kimi", ASSISTANT_ID, USER_MESSAGES, [], undefined, undefined);
}

describe("runStream tool-round loop", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSendChat.mockReset();
    mockExecuteTool.mockReset();
    // The tool-failure paths log a non-fatal warning by design; keep it out of the test output.
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("streams a single turn and completes when the model asks for no tools", async () => {
    scriptTurns([[chatEvent("Hello")]]);
    const { ctx, queryClient, light } = makeCtx();

    await run(ctx);

    expect(mockSendChat).toHaveBeenCalledTimes(1);
    expect(mockExecuteTool).not.toHaveBeenCalled();
    expect(tailMessage(queryClient).content).toBe("Hello");
    expect(tailMessage(queryClient).status).toBe("complete");
    expect(light).toHaveBeenCalled();
  });

  it("runs the requested tool, feeds its result back, and re-streams the answer", async () => {
    scriptTurns([
      [chatEvent("Let me search"), toolCallsEvent([wsCall("ollama news")])],
      [chatEvent("Here is the answer")],
    ]);
    mockExecuteTool.mockResolvedValue('{"results":[]}');
    const { ctx, queryClient, setToolActivity } = makeCtx();

    await run(ctx);

    expect(mockSendChat).toHaveBeenCalledTimes(2);
    expect(mockExecuteTool).toHaveBeenCalledTimes(1);
    expect(mockExecuteTool).toHaveBeenCalledWith(ctx.client, wsCall("ollama news"));

    // The second turn carries the assistant tool-call turn plus the tool result.
    const secondTurnMessages = mockSendChat.mock.calls[1][1].messages;
    expect(secondTurnMessages).toContainEqual({
      role: "assistant",
      content: "Let me search",
      tool_calls: [wsCall("ollama news")],
    });
    expect(secondTurnMessages).toContainEqual({
      role: "tool",
      content: '{"results":[]}',
      tool_name: "web_search",
    });

    expect(setToolActivity).toHaveBeenCalledWith(CHAT_ID, {
      name: "web_search",
      query: "ollama news",
    });
    expect(setToolActivity).toHaveBeenLastCalledWith(CHAT_ID, null);
    // Content accumulates across rounds: the pre-tool narration stays in the bubble ahead of the answer.
    expect(tailMessage(queryClient).content).toBe("Let me searchHere is the answer");
  });

  it("stops re-streaming once the round cap trips", async () => {
    // Every turn asks for another tool, so only the cap can end the loop.
    mockSendChat.mockImplementation(async function* () {
      yield chatEvent("looping");
      yield toolCallsEvent([wsCall("again")]);
    });
    mockExecuteTool.mockResolvedValue("[]");
    const { ctx } = makeCtx();

    await run(ctx);

    // One final stream that still asked for tools but tripped the cap, hence cap + 1 streams / cap executions.
    expect(mockSendChat).toHaveBeenCalledTimes(WEB_SEARCH_MAX_TOOL_ROUNDS + 1);
    expect(mockExecuteTool).toHaveBeenCalledTimes(WEB_SEARCH_MAX_TOOL_ROUNDS);
  });

  it("flags webSearchFailed when a tool throws but still completes the answer", async () => {
    scriptTurns([
      [chatEvent("searching"), toolCallsEvent([wsCall("q")])],
      [chatEvent("done anyway")],
    ]);
    mockExecuteTool.mockRejectedValue(new Error("network down"));
    const { ctx, queryClient, update } = makeCtx();

    await run(ctx);

    const secondTurnMessages = mockSendChat.mock.calls[1][1].messages;
    expect(secondTurnMessages).toContainEqual({
      role: "tool",
      content: "Tool web_search failed.",
      tool_name: "web_search",
    });
    expect(tailMessage(queryClient).content).toBe("searchingdone anyway");
    expect(tailMessage(queryClient).webSearchFailed).toBe(true);
    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ status: "complete", webSearchFailed: true }),
    );
  });

  it("resets webSearchFailed when a later round recovers", async () => {
    scriptTurns([
      [chatEvent("try 1"), toolCallsEvent([wsCall("a")])],
      [chatEvent("try 2"), toolCallsEvent([wsCall("b")])],
      [chatEvent("final answer")],
    ]);
    // First round's tool fails, second round's succeeds.
    mockExecuteTool
      .mockRejectedValueOnce(new Error("flaky"))
      .mockResolvedValue("[]");
    const { ctx, queryClient } = makeCtx();

    await run(ctx);

    expect(mockExecuteTool).toHaveBeenCalledTimes(2);
    expect(tailMessage(queryClient).webSearchFailed).toBe(false);
  });
});
