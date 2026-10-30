import { QueryClient } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";
import type { ApiClient } from "@/lib/api/client";
import { CloudAPIError } from "@/lib/api/errors";
import type { MessageRepository } from "@/lib/db/messageRepository";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { useSettingsStore } from "@/lib/stores/settings.store";
import type { UseHapticsResult } from "@/lib/hooks/useHaptics";
import type { DbMemoryFact } from "@/lib/db/types";
import { asChatId, asFactId, asMessageId, type FactId } from "@/lib/types/ids";
import {
  type ChatEventUnion,
  sendChatMessage,
  type WireChatMessage,
} from "@/modules/chat/api/chat";
import { TOOL_MAX_ROUNDS } from "@/modules/chat/constants";
import type { UseChatData } from "@/modules/chat/hooks/useChat";
import {
  type RunStreamContext,
  runStream,
  type StreamSeed,
} from "@/modules/chat/lib/streamPipeline";
import { MEMORY_REPLIES } from "@/modules/chat/lib/memoryGate";
import { notifyAnswerReady } from "@/lib/notifications/answerNotification";
import { releaseBackgroundAssertion } from "@/modules/chat/lib/backgroundAssertion";
import {
  executeToolCall,
  MEMORY_TOOLS,
  type MemoryRun,
  type ToolDefinition,
  WEB_TOOLS,
  type WireToolCall,
} from "@/modules/chat/lib/tools";

// The pipeline pulls turns off this generator and runs web calls through executeToolCall; both are stubbed, while the
// memory routing in tools stays real so the pipeline's own gate wiring is what gets tested.
jest.mock("@/modules/chat/api/chat", () => ({ sendChatMessage: jest.fn() }));
jest.mock("@/modules/chat/api/webSearch", () => ({
  webSearch: jest.fn(),
  webFetch: jest.fn(),
}));
jest.mock("@/modules/chat/lib/tools", () => ({
  ...jest.requireActual("@/modules/chat/lib/tools"),
  executeToolCall: jest.fn(),
}));
jest.mock("@/lib/notifications/answerNotification", () => ({
  notifyAnswerReady: jest.fn(async () => {}),
}));
jest.mock("@/modules/chat/lib/backgroundAssertion", () => ({
  holdBackgroundAssertion: jest.fn(),
  releaseBackgroundAssertion: jest.fn(),
}));

const mockSendChat = sendChatMessage as jest.MockedFunction<typeof sendChatMessage>;
const mockExecuteTool = executeToolCall as jest.MockedFunction<typeof executeToolCall>;
const mockNotify = notifyAnswerReady as jest.MockedFunction<
  typeof notifyAnswerReady
>;
const mockRelease = releaseBackgroundAssertion as jest.MockedFunction<
  typeof releaseBackgroundAssertion
>;

const CHAT_ID = asChatId("chat-1");
const ASSISTANT_ID = asMessageId(1);

function chatEvent(content: string): ChatEventUnion {
  return { eventName: "chat", content } as ChatEventUnion;
}

function thinkingEvent(thinking: string): ChatEventUnion {
  return { eventName: "thinking", thinking } as ChatEventUnion;
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
  const setReasoning = jest.fn();
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
    setReasoning,
    haptics: { light } as unknown as UseHapticsResult,
    controllerRef: { current: null as AbortController | null },
  };

  return {
    ctx,
    queryClient,
    update,
    setToolActivity,
    setReasoning,
    endStream,
    light,
  };
}

function tailMessage(queryClient: QueryClient) {
  const data = queryClient.getQueryData<UseChatData>(queryKeys.chat(CHAT_ID));
  const list = data?.messages ?? [];
  return list[list.length - 1] as {
    content: string;
    status: string;
    webSearchFailed: boolean;
    hasReadWeb: boolean;
  };
}

const USER_MESSAGES: WireChatMessage[] = [{ role: "user", content: "hi" }];

// Web tools are offered by default: runStream only executes a tool the request actually offered.
function run(ctx: RunStreamContext): Promise<void> {
  return runStream(
    ctx,
    "kimi",
    ASSISTANT_ID,
    USER_MESSAGES,
    undefined,
    WEB_TOOLS,
  );
}

function runWith(
  ctx: RunStreamContext,
  tools: readonly ToolDefinition[],
  memory?: MemoryRun,
): Promise<void> {
  return runStream(
    ctx,
    "kimi",
    ASSISTANT_ID,
    USER_MESSAGES,
    undefined,
    tools,
    memory,
  );
}

function rememberCall(fact: string): WireToolCall {
  return { function: { name: "remember_fact", arguments: { fact } } };
}

// An in-memory stand-in for MemoryRepository, since SQLite does not run under Jest.
interface FakeMemory {
  memory: MemoryRun;
  add: jest.Mock;
}

function fakeMemory(): FakeMemory {
  let rows: DbMemoryFact[] = [];
  const add = jest.fn(async (content: string): Promise<DbMemoryFact> => {
    const row = {
      id: asFactId(rows.length + 1),
      content,
      createdAt: rows.length + 1,
    };
    rows = [...rows, row];
    return row;
  });
  const memory: MemoryRun = {
    store: {
      list: async (): Promise<DbMemoryFact[]> => [...rows],
      add,
      remove: async (_id: FactId): Promise<boolean> => false,
    },
    hasUntrustedContext: false,
  };
  return { memory, add };
}

// Tool results fed back on the LAST stream, in order, so a test reads what the model was told.
function toolResults(): string[] {
  const calls = mockSendChat.mock.calls;
  const last = calls[calls.length - 1][1].messages;
  return last.filter((m) => m.role === "tool").map((m) => m.content);
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
    // Content accumulates across rounds: the pre-tool narration stays in the bubble, a paragraph ahead of the answer.
    expect(tailMessage(queryClient).content).toBe(
      "Let me search\n\nHere is the answer",
    );
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
    expect(mockSendChat).toHaveBeenCalledTimes(TOOL_MAX_ROUNDS + 1);
    expect(mockExecuteTool).toHaveBeenCalledTimes(TOOL_MAX_ROUNDS);
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
    expect(tailMessage(queryClient).content).toBe("searching\n\ndone anyway");
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

  it("runs a memory call silently, without the web activity line or note", async () => {
    scriptTurns([
      [toolCallsEvent([rememberCall("Likes tea")])],
      [chatEvent("Noted")],
    ]);
    const { ctx, queryClient, setToolActivity } = makeCtx();
    const { memory, add } = fakeMemory();

    await runWith(ctx, [...WEB_TOOLS, ...MEMORY_TOOLS], memory);

    expect(add).toHaveBeenCalledWith("Likes tea", expect.any(Number));
    expect(setToolActivity).not.toHaveBeenCalledWith(
      CHAT_ID,
      expect.objectContaining({ name: "remember_fact" }),
    );
    expect(toolResults()).toEqual(["Saved as id 1."]);
    expect(mockExecuteTool).not.toHaveBeenCalled();
    expect(tailMessage(queryClient).webSearchFailed).toBe(false);
  });

  it("keeps an earlier web failure standing through a memory-only round", async () => {
    scriptTurns([
      [toolCallsEvent([wsCall("q")])],
      [toolCallsEvent([rememberCall("Likes tea")])],
      [chatEvent("answer")],
    ]);
    mockExecuteTool.mockRejectedValue(new Error("network down"));
    const { ctx, queryClient } = makeCtx();
    const { memory } = fakeMemory();

    await runWith(ctx, [...WEB_TOOLS, ...MEMORY_TOOLS], memory);

    expect(tailMessage(queryClient).webSearchFailed).toBe(true);
  });

  it("makes memory read-only once a web tool has run in the reply", async () => {
    scriptTurns([
      [toolCallsEvent([wsCall("rome"), rememberCall("Lives in Rome")])],
      [chatEvent("answer")],
    ]);
    mockExecuteTool.mockResolvedValue("[]");
    const { ctx } = makeCtx();
    const { memory, add } = fakeMemory();

    await runWith(ctx, [...WEB_TOOLS, ...MEMORY_TOOLS], memory);

    expect(add).not.toHaveBeenCalled();
    expect(toolResults()).toEqual(["[]", MEMORY_REPLIES.readOnly]);
  });

  // Web search is on by default, so the switch alone must not lock memory: only a search that ran marks the reply.
  it("marks the reply as having read the web only when a web tool ran", async () => {
    scriptTurns([[toolCallsEvent([wsCall("q")])], [chatEvent("answer")]]);
    mockExecuteTool.mockResolvedValue("[]");
    const searched = makeCtx();
    await runWith(
      searched.ctx,
      [...WEB_TOOLS, ...MEMORY_TOOLS],
      fakeMemory().memory,
    );
    expect(searched.update).toHaveBeenCalledWith(ASSISTANT_ID, {
      hasReadWeb: true,
    });
    expect(tailMessage(searched.queryClient).hasReadWeb).toBe(true);

    scriptTurns([[chatEvent("no search needed")]]);
    const unsearched = makeCtx();
    await runWith(
      unsearched.ctx,
      [...WEB_TOOLS, ...MEMORY_TOOLS],
      fakeMemory().memory,
    );
    expect(tailMessage(unsearched.queryClient).hasReadWeb).toBe(false);
  });

  it("never runs a web tool the request did not offer", async () => {
    scriptTurns([[toolCallsEvent([wsCall("guess")])], [chatEvent("answer")]]);
    const { ctx, setToolActivity } = makeCtx();
    const { memory } = fakeMemory();

    await runWith(ctx, MEMORY_TOOLS, memory);

    expect(mockExecuteTool).not.toHaveBeenCalled();
    expect(setToolActivity).not.toHaveBeenCalledWith(
      CHAT_ID,
      expect.objectContaining({ name: "web_search" }),
    );
    expect(toolResults()).toEqual(["Tool web_search is not available."]);
  });

  it("keeps each round's text apart in the bubble and in the replayed tool-call turns", async () => {
    scriptTurns([
      [chatEvent("Nice to meet you, Matteo!"), toolCallsEvent([rememberCall("Name is Matteo")])],
      [chatEvent("Got it."), toolCallsEvent([rememberCall("Likes tea")])],
      [chatEvent("Anything else?")],
    ]);
    const { ctx, queryClient } = makeCtx();
    const { memory } = fakeMemory();

    await runWith(ctx, MEMORY_TOOLS, memory);

    expect(tailMessage(queryClient).content).toBe(
      "Nice to meet you, Matteo!\n\nGot it.\n\nAnything else?",
    );
    const lastTurn = mockSendChat.mock.calls[2][1].messages;
    expect(
      lastTurn.filter((m) => m.role === "assistant").map((m) => m.content),
    ).toEqual(["Nice to meet you, Matteo!", "Got it."]);
  });

  it("does not open a paragraph for a round when nothing visible came before it", async () => {
    scriptTurns([
      [toolCallsEvent([rememberCall("Likes tea")])],
      [chatEvent("Noted")],
    ]);
    const { ctx, queryClient } = makeCtx();
    const { memory } = fakeMemory();

    await runWith(ctx, MEMORY_TOOLS, memory);

    expect(tailMessage(queryClient).content).toBe("Noted");
  });

  it("caps successful saves per reply across rounds", async () => {
    scriptTurns([
      [toolCallsEvent([rememberCall("Likes tea"), rememberCall("Has a cat")])],
      [toolCallsEvent([rememberCall("Plays chess")])],
      [chatEvent("answer")],
    ]);
    const { ctx } = makeCtx();
    const { memory, add } = fakeMemory();

    await runWith(ctx, MEMORY_TOOLS, memory);

    expect(add).toHaveBeenCalledTimes(2);
    expect(toolResults()[2]).toBe(MEMORY_REPLIES.saveLimit);
  });

  it("does not tear down the stream that superseded it (edit-during-stream restart)", async () => {
    // Simulates auto-abort-then-restart: a fresh stream takes ownership of controllerRef mid-flight, so this
    // pipeline's teardown must leave the replacement's shared state (streaming set + ref) untouched. Guards race #8.
    const { ctx, endStream } = makeCtx();
    const replacement = new AbortController();
    mockSendChat.mockImplementation(async function* () {
      ctx.controllerRef.current = replacement;
      yield chatEvent("stale");
    });

    await run(ctx);

    expect(endStream).not.toHaveBeenCalled();
    expect(ctx.controllerRef.current).toBe(replacement);
  });

  // The reasoning flag drives the shimmer that tells a long wait apart from a freeze, and it is inferred rather than
  // announced. Every case below asserts the LAST call, because that is the one the user ends up looking at.
  it("clears the reasoning flag on a token that grows the answer", async () => {
    scriptTurns([[chatEvent("Hello")]]);
    const { ctx, setReasoning } = makeCtx();

    await run(ctx);

    expect(setReasoning).toHaveBeenLastCalledWith(CHAT_ID, false);
  });

  it("keeps the reasoning flag when a token only feeds an inline think", async () => {
    scriptTurns([[chatEvent("<think>still going")]]);
    const { ctx, setReasoning } = makeCtx();

    await run(ctx);

    expect(setReasoning).toHaveBeenLastCalledWith(CHAT_ID, true);
  });

  // Two tokens, so the comparison has to be captured per token: frozen at the buffer's initial length it would read
  // this as "still writing" and the shimmer would never come back for the rest of the answer.
  it("flags reasoning again when a later token only adds thought", async () => {
    scriptTurns([[chatEvent("Hello"), chatEvent("<think>wait")]]);
    const { ctx, setReasoning } = makeCtx();

    await run(ctx);

    expect(setReasoning).toHaveBeenLastCalledWith(CHAT_ID, true);
  });

  // A `<think>` completing across two chunks: the buffer ends mid-thought even though the visible answer just shrank.
  it("flags reasoning when a tag completes across two chunks", async () => {
    scriptTurns([[chatEvent("a<think"), chatEvent(">b")]]);
    const { ctx, setReasoning } = makeCtx();

    await run(ctx);

    expect(setReasoning).toHaveBeenLastCalledWith(CHAT_ID, true);
  });

  // The mirror case, and the one a length comparison gets backwards: the bare close reclassifies shown text as thought,
  // so the answer SHRINKS, but the same delta carries fresh visible text — the model is writing, not thinking.
  it("clears the flag when a bare close is followed by fresh content", async () => {
    scriptTurns([[chatEvent("ABCDE"), chatEvent("</think>X")]]);
    const { ctx, setReasoning } = makeCtx();

    await run(ctx);

    expect(setReasoning).toHaveBeenLastCalledWith(CHAT_ID, false);
  });

  it("sets the reasoning flag on a thinking event", async () => {
    scriptTurns([[thinkingEvent("weighing options")]]);
    const { ctx, setReasoning } = makeCtx();

    await run(ctx);

    expect(setReasoning).toHaveBeenLastCalledWith(CHAT_ID, true);
  });
});

describe("runStream when the app leaves the foreground", () => {
  let warnSpy: jest.SpyInstance;
  let appStateSpy: jest.SpyInstance;
  let listeners: ((state: AppStateStatus) => void)[];

  beforeEach(() => {
    mockSendChat.mockReset();
    mockExecuteTool.mockReset();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    setAppState("active");
    listeners = [];
    appStateSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, handler) => {
        listeners.push(handler as (state: AppStateStatus) => void);
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof AppState.addEventListener
        >;
      });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    appStateSpy.mockRestore();
  });

  // `currentState` is a plain property on the AppState module, so the tests move it the way the OS would.
  function setAppState(state: AppStateStatus): void {
    Object.defineProperty(AppState, "currentState", {
      value: state,
      configurable: true,
      writable: true,
    });
  }

  // A suspended process cannot drain its own socket, so the stream dies looking like a transport failure.
  function scriptBackgroundDeath(background: boolean): void {
    mockSendChat.mockImplementation(async function* () {
      yield chatEvent("Half an ans");
      if (background) for (const notify of listeners) notify("background");
      throw new TypeError("Network request failed");
    });
  }

  it("ends the turn interrupted, keeping what had streamed", async () => {
    scriptBackgroundDeath(true);
    const { ctx, update } = makeCtx();

    await run(ctx);

    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({
        status: "interrupted",
        errorCode: null,
        content: "Half an ans",
      }),
    );
  });

  it("still reports a transport failure the app was present for", async () => {
    scriptBackgroundDeath(false);
    const { ctx, update } = makeCtx();

    await expect(run(ctx)).rejects.toThrow("Network request failed");
    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ status: "error", errorCode: "network" }),
    );
  });

  // Android stops the activity on a screen lock without suspending anything, so the socket outlives the trip and
  // every later failure would otherwise be relabelled for the rest of the stream.
  it("forgets the trip once the user is back and events still arrive", async () => {
    mockSendChat.mockImplementation(async function* () {
      yield chatEvent("Half an ans");
      for (const notify of listeners) notify("background");
      setAppState("background");
      yield chatEvent("wer kept");
      setAppState("active");
      yield chatEvent(" coming");
      throw new TypeError("Network request failed");
    });
    const { ctx, update } = makeCtx();

    await expect(run(ctx)).rejects.toThrow("Network request failed");
    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ status: "error", errorCode: "network" }),
    );
  });

  // iOS keeps delivering for a few seconds after the app backgrounds and only then suspends, so those tokens must
  // not be read as the user having come back — that is the whole reported scenario.
  it("holds the trip through tokens that arrive before the suspension", async () => {
    mockSendChat.mockImplementation(async function* () {
      yield chatEvent("Half an ans");
      for (const notify of listeners) notify("background");
      setAppState("background");
      yield chatEvent("wer still landing");
      throw new TypeError("Network request failed");
    });
    const { ctx, update } = makeCtx();

    await run(ctx);

    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ status: "interrupted", errorCode: null }),
    );
  });

  // The cloud answered, so the socket was alive: an exhausted plan reported as "interrupted" is a Retry loop that
  // never explains itself.
  it("still reports a cloud error raised after the trip", async () => {
    mockSendChat.mockImplementation(async function* () {
      yield chatEvent("Half an ans");
      for (const notify of listeners) notify("background");
      throw new CloudAPIError(403, "subscription_required");
    });
    const { ctx, update } = makeCtx();

    await expect(run(ctx)).rejects.toThrow("subscription_required");
    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ status: "error", errorCode: "subscription" }),
    );
  });

  it("removes the listener even when the failure propagates", async () => {
    scriptBackgroundDeath(false);
    const { ctx } = makeCtx();

    await expect(run(ctx)).rejects.toThrow();
    const subscription = appStateSpy.mock.results[0]?.value as {
      remove: jest.Mock;
    };
    expect(subscription.remove).toHaveBeenCalled();
  });

  // `inactive` is the app switcher and the Control Center shade: visible but not suspended, and not a return either.
  it("does not treat the inactive shade as the user coming back", async () => {
    mockSendChat.mockImplementation(async function* () {
      yield chatEvent("Half an ans");
      for (const notify of listeners) notify("background");
      setAppState("inactive");
      yield chatEvent("wer still landing");
      throw new TypeError("Network request failed");
    });
    const { ctx, update } = makeCtx();

    await run(ctx);

    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ status: "interrupted", errorCode: null }),
    );
  });

  describe("the answer-ready notification", () => {
    beforeEach(() => {
      mockNotify.mockClear();
      mockRelease.mockClear();
      useSettingsStore.setState({ isAnswerNotificationEnabled: true });
      mockSendChat.mockImplementation(async function* () {
        yield chatEvent("Done while away.");
        setAppState("background");
      });
    });

    afterEach(() => {
      useSettingsStore.setState({ isAnswerNotificationEnabled: false });
    });

    // Posted after the release, iOS could suspend the app before it ever had the banner.
    it("posts for an answer that finished away, before the background window closes", async () => {
      const { ctx } = makeCtx();

      await run(ctx);

      expect(mockNotify).toHaveBeenCalledWith(CHAT_ID);
      expect(mockNotify.mock.invocationCallOrder[0]).toBeLessThan(
        mockRelease.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("stays quiet while the switch is off", async () => {
      useSettingsStore.setState({ isAnswerNotificationEnabled: false });
      const { ctx } = makeCtx();

      await run(ctx);

      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("stays quiet when the user watched the answer finish", async () => {
      mockSendChat.mockImplementation(async function* () {
        yield chatEvent("Done in front of you.");
      });
      const { ctx } = makeCtx();

      await run(ctx);

      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("stays quiet for an answer the user stopped", async () => {
      const { ctx, update } = makeCtx();
      mockSendChat.mockImplementation(async function* () {
        yield chatEvent("Half");
        setAppState("background");
        ctx.controllerRef.current?.abort();
        yield chatEvent(" more");
      });

      await run(ctx);

      expect(update).toHaveBeenLastCalledWith(
        ASSISTANT_ID,
        expect.objectContaining({ status: "interrupted" }),
      );
      expect(mockNotify).not.toHaveBeenCalled();
    });
  });

  it("only a real backgrounding counts, not the transient inactive state", async () => {
    mockSendChat.mockImplementation(async function* () {
      yield chatEvent("Half an ans");
      for (const notify of listeners) notify("inactive");
      throw new TypeError("Network request failed");
    });
    const { ctx, update } = makeCtx();

    await expect(run(ctx)).rejects.toThrow("Network request failed");
    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ status: "error" }),
    );
  });
});

describe("runStream continuation", () => {
  let appStateSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSendChat.mockReset();
    appStateSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation(
        () =>
          ({ remove: jest.fn() }) as unknown as ReturnType<
            typeof AppState.addEventListener
          >,
      );
  });

  afterEach(() => {
    appStateSpy.mockRestore();
  });

  const SEED: StreamSeed = {
    content: "1. Rome\n2. Mil",
    thinking: "Listing cities.",
    hasReadWeb: false,
    hasWebSearchFailed: false,
  };

  function runSeeded(ctx: RunStreamContext): Promise<void> {
    return runStream(
      ctx,
      "kimi",
      ASSISTANT_ID,
      USER_MESSAGES,
      undefined,
      undefined,
      undefined,
      SEED,
    );
  }

  it("appends new text to the saved half and completes", async () => {
    scriptTurns([[chatEvent("an\n3. Turin")]]);
    const { ctx, queryClient } = makeCtx();

    await runSeeded(ctx);

    expect(tailMessage(queryClient).content).toBe(
      "1. Rome\n2. Milan\n3. Turin",
    );
    expect(tailMessage(queryClient).status).toBe("complete");
  });

  // A continuation that adds nothing must not close the answer, or the cut text would lose its only way forward.
  it("stays interrupted, text intact, when nothing new arrives", async () => {
    scriptTurns([[thinkingEvent("Hmm.")]]);
    const { ctx, queryClient, update } = makeCtx();

    await runSeeded(ctx);

    expect(tailMessage(queryClient).content).toBe(SEED.content);
    expect(tailMessage(queryClient).status).toBe("interrupted");
    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ thinking: `${SEED.thinking}\n\nHmm.` }),
    );
    expect(update).not.toHaveBeenCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ status: "complete" }),
    );
  });

  it("stays interrupted when the only new content is inline reasoning", async () => {
    scriptTurns([[chatEvent("<think>Already done.</think>")]]);
    const { ctx, queryClient } = makeCtx();

    await runSeeded(ctx);

    expect(tailMessage(queryClient).content).toBe(SEED.content);
    expect(tailMessage(queryClient).status).toBe("interrupted");
  });

  it("drops an invisible lead so the cut word joins cleanly", async () => {
    scriptTurns([[chatEvent("\u200Ban\n3. Turin")]]);
    const { ctx, queryClient } = makeCtx();

    await runSeeded(ctx);

    expect(tailMessage(queryClient).content).toBe(
      "1. Rome\n2. Milan\n3. Turin",
    );
  });

  it("leaves the saved text byte-identical when only whitespace arrives", async () => {
    scriptTurns([[chatEvent("\n")]]);
    const { ctx, queryClient } = makeCtx();

    await runSeeded(ctx);

    expect(tailMessage(queryClient).content).toBe(SEED.content);
    expect(tailMessage(queryClient).status).toBe("interrupted");
  });

  it("joins the cut word after inline reasoning and its line break", async () => {
    scriptTurns([[chatEvent("<think>Go on.</think>\n\nan\n3. Turin")]]);
    const { ctx, queryClient } = makeCtx();

    await runSeeded(ctx);

    expect(tailMessage(queryClient).content).toBe(
      "1. Rome\n2. Milan\n3. Turin",
    );
  });

  it("keeps a real space after inline reasoning", async () => {
    scriptTurns([[chatEvent("<think>ok</think> 3. Turin")]]);
    const { ctx, queryClient } = makeCtx();

    await runSeeded(ctx);

    expect(tailMessage(queryClient).content).toBe("1. Rome\n2. Mil 3. Turin");
  });

  // Offline or out of quota before any new text: error would leave only the wiping Retry, so it stays continuable.
  it("stays interrupted and rethrows when it fails before adding text", async () => {
    mockSendChat.mockImplementation(async function* () {
      yield* [];
      throw new Error("Network request failed");
    });
    const { ctx, queryClient } = makeCtx();

    await expect(runSeeded(ctx)).rejects.toThrow("Network request failed");

    expect(tailMessage(queryClient).content).toBe(SEED.content);
    expect(tailMessage(queryClient).status).toBe("interrupted");
  });

  it("stays interrupted when the only new content is invisible", async () => {
    scriptTurns([[chatEvent("\u200B")]]);
    const { ctx, queryClient } = makeCtx();

    await runSeeded(ctx);

    expect(tailMessage(queryClient).status).toBe("interrupted");
  });

  it("glues onto the cut word even after a round that only searched", async () => {
    scriptTurns([
      [toolCallsEvent([wsCall("cities")])],
      [chatEvent("an\n3. Turin")],
    ]);
    mockExecuteTool.mockResolvedValue("[]");
    const { ctx, queryClient } = makeCtx();

    await runStream(
      ctx,
      "kimi",
      ASSISTANT_ID,
      USER_MESSAGES,
      undefined,
      WEB_TOOLS,
      undefined,
      SEED,
    );

    expect(tailMessage(queryClient).content).toBe(
      "1. Rome\n2. Milan\n3. Turin",
    );
  });

  it("keeps the saved reasoning when the continuation does not reason again", async () => {
    scriptTurns([[chatEvent("an")]]);
    const { ctx, update } = makeCtx();

    await runSeeded(ctx);

    expect(update).toHaveBeenLastCalledWith(
      ASSISTANT_ID,
      expect.objectContaining({ thinking: SEED.thinking, status: "complete" }),
    );
  });
});
