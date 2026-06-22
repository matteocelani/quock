import { QueryClient } from "@tanstack/react-query";
import type { ChatRepository } from "@/lib/db/chatRepository";
import type { DbAttachment, DbMessage } from "@/lib/db/types";
import { queryKeys } from "@/lib/hooks/queryKeys";
import {
  asAttachmentId,
  asChatId,
  asMessageId,
  type MessageId,
} from "@/lib/types/ids";
import type { UseChatData } from "@/modules/chat/hooks/useChat";
import {
  bumpSidebar,
  gateVisionAttachments,
  locateAssistantTurn,
  narrowApiAttachments,
  patchChatCache,
  pruneAttachmentMap,
  toWireHistory,
} from "@/modules/chat/lib/sendHelpers";

const CHAT_ID = asChatId("chat-1");

function dbMsg(
  id: number,
  role: "user" | "assistant" | "tool",
  content = "",
): DbMessage {
  return {
    id: asMessageId(id),
    chatId: CHAT_ID,
    role,
    content,
    thinking: null,
    model: null,
    createdAt: 0,
    updatedAt: 0,
    thinkingTimeStart: null,
    thinkingTimeEnd: null,
    status: "complete",
    errorCode: null,
    webSearchFailed: false,
    sentWithThink: false,
    sentWithWebSearch: false,
  };
}

function dbAtt(id: number, mimeType: string | null): DbAttachment {
  return {
    id: asAttachmentId(id),
    messageId: asMessageId(id),
    filename: `file-${id}`,
    mimeType,
    data: new Uint8Array([id]),
    uri: null,
    sizeBytes: 1,
  };
}

function makeQueryClient(): QueryClient {
  // gcTime Infinity keeps the cache from scheduling a gc timer that would outlive the test.
  return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
}

describe("gateVisionAttachments", () => {
  const rows = [dbAtt(1, "image/png"), dbAtt(2, "application/pdf"), dbAtt(3, null)];

  it("returns the rows untouched when the model has vision", () => {
    expect(gateVisionAttachments(rows, true)).toBe(rows);
  });

  it("drops image attachments (keeping non-image and untyped) without vision", () => {
    expect(gateVisionAttachments(rows, false).map((a) => a.filename)).toEqual([
      "file-2",
      "file-3",
    ]);
  });

  it("treats an undefined mimeType as non-image", () => {
    const ui = [{ mimeType: undefined }, { mimeType: "image/jpeg" }];
    expect(gateVisionAttachments(ui, false)).toEqual([{ mimeType: undefined }]);
  });
});

describe("narrowApiAttachments", () => {
  it("keeps bytes + filename and omits mimeType only when null", () => {
    expect(narrowApiAttachments([dbAtt(1, "image/png"), dbAtt(2, null)])).toEqual([
      { filename: "file-1", data: new Uint8Array([1]), mimeType: "image/png" },
      { filename: "file-2", data: new Uint8Array([2]) },
    ]);
  });
});

describe("toWireHistory", () => {
  it("maps only user + assistant turns to role/content pairs", () => {
    const messages = [
      dbMsg(1, "user", "hi"),
      dbMsg(2, "assistant", "hello"),
      dbMsg(3, "tool", "tool output"),
      dbMsg(4, "user", "again"),
    ];
    expect(toWireHistory(messages)).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "again" },
    ]);
  });
});

describe("locateAssistantTurn", () => {
  it("returns the assistant index and its preceding user turn", () => {
    const messages = [dbMsg(1, "user"), dbMsg(2, "assistant")];
    expect(locateAssistantTurn(messages, asMessageId(2), "Regenerate")).toEqual({
      assistantIndex: 1,
      priorUser: messages[0],
    });
  });

  it("throws (context-prefixed) when the assistant turn is missing", () => {
    const messages = [dbMsg(1, "user"), dbMsg(2, "assistant")];
    expect(() => locateAssistantTurn(messages, asMessageId(999), "Retry")).toThrow(
      "Retry: assistant message not found",
    );
  });

  it("throws when the assistant turn is first (no prior user)", () => {
    expect(() =>
      locateAssistantTurn([dbMsg(5, "assistant")], asMessageId(5), "Regenerate"),
    ).toThrow("Regenerate: assistant message not found");
  });

  it("throws when the preceding turn is not a user message", () => {
    const messages = [dbMsg(10, "assistant"), dbMsg(20, "assistant")];
    expect(() => locateAssistantTurn(messages, asMessageId(20), "Retry")).toThrow(
      "Retry: no preceding user message",
    );
  });
});

describe("pruneAttachmentMap", () => {
  const att1 = [dbAtt(1, null)];
  const att2 = [dbAtt(2, null)];
  const attDropped = [dbAtt(99, null)];
  const existing = {
    attachmentsByMessage: new Map<MessageId, DbAttachment[]>([
      [asMessageId(1), att1],
      [asMessageId(2), att2],
      [asMessageId(99), attDropped],
    ]),
  } as unknown as UseChatData;
  const kept = [dbMsg(1, "user"), dbMsg(2, "assistant")];

  it("keeps only entries whose message survives and re-asserts the given turn", () => {
    const reassert = [dbAtt(7, "image/png")];
    const result = pruneAttachmentMap(existing, kept, {
      messageId: asMessageId(1),
      rows: reassert,
    });
    expect([...result.keys()]).toEqual([asMessageId(1), asMessageId(2)]);
    expect(result.get(asMessageId(1))).toBe(reassert);
  });

  it("leaves the pruned map untouched when the re-assert rows are empty", () => {
    const result = pruneAttachmentMap(existing, kept, {
      messageId: asMessageId(1),
      rows: [],
    });
    expect([...result.keys()]).toEqual([asMessageId(1), asMessageId(2)]);
    expect(result.get(asMessageId(1))).toBe(att1);
  });

  it("starts from an empty map on a cold cache", () => {
    const reassert = [dbAtt(7, null)];
    const result = pruneAttachmentMap(undefined, kept, {
      messageId: asMessageId(1),
      rows: reassert,
    });
    expect([...result.keys()]).toEqual([asMessageId(1)]);
    expect(result.get(asMessageId(1))).toBe(reassert);
  });
});

describe("patchChatCache", () => {
  it("writes the cache reusing already-loaded chat metadata", async () => {
    const queryClient = makeQueryClient();
    const chats = { get: jest.fn() } as unknown as ChatRepository;
    const existing = {
      chat: { id: CHAT_ID, title: "T" },
      messages: [],
      attachmentsByMessage: new Map(),
    } as unknown as UseChatData;
    const updated = [dbMsg(1, "user")];
    const attachmentsByMessage = new Map<MessageId, DbAttachment[]>();

    await patchChatCache(queryClient, chats, CHAT_ID, existing, updated, attachmentsByMessage);

    expect(chats.get).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<UseChatData>(queryKeys.chat(CHAT_ID))).toEqual({
      chat: existing.chat,
      messages: updated,
      attachmentsByMessage,
    });
  });

  it("hydrates the chat row from the DB on a cold cache", async () => {
    const queryClient = makeQueryClient();
    const chat = { id: CHAT_ID, title: "from-db" };
    const chats = {
      get: jest.fn().mockResolvedValue(chat),
    } as unknown as ChatRepository;

    await patchChatCache(queryClient, chats, CHAT_ID, undefined, [], new Map());

    expect(chats.get).toHaveBeenCalledWith(CHAT_ID);
    expect(
      queryClient.getQueryData<UseChatData>(queryKeys.chat(CHAT_ID))?.chat,
    ).toBe(chat);
  });

  it("skips the write when the chat row is gone", async () => {
    const queryClient = makeQueryClient();
    const chats = {
      get: jest.fn().mockResolvedValue(null),
    } as unknown as ChatRepository;

    await patchChatCache(queryClient, chats, CHAT_ID, undefined, [], new Map());

    expect(queryClient.getQueryData(queryKeys.chat(CHAT_ID))).toBeUndefined();
  });
});

describe("bumpSidebar", () => {
  it("touches the chat then invalidates the sidebar list query", async () => {
    const queryClient = makeQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const touchUpdated = jest.fn().mockResolvedValue(undefined);
    const chats = { touchUpdated } as unknown as ChatRepository;

    await bumpSidebar(chats, queryClient, CHAT_ID);

    expect(touchUpdated).toHaveBeenCalledWith(CHAT_ID);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.chats() });
  });
});
