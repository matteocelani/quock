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
  describePageCuts,
  describePickFailures,
  gateVisionAttachments,
  locateAssistantTurn,
  patchChatCache,
  pruneAttachmentMap,
  toWireHistory,
  topNotice,
} from "@/modules/chat/lib/sendHelpers";
import { PDF_OCR_MAX_PAGES } from "@/modules/chat/constants";

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
    sentWithAgent: false,
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
    textContent: null,
    derivedFrom: null,
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

describe("toWireHistory", () => {
  it("maps only user + assistant turns to role/content pairs", () => {
    const messages = [
      dbMsg(1, "user", "hi"),
      dbMsg(2, "assistant", "hello"),
      dbMsg(3, "tool", "tool output"),
      dbMsg(4, "user", "again"),
    ];
    expect(toWireHistory(messages).messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "again" },
    ]);
  });

  // The bug this shape exists to kill: the document used to reach the model only on the turn it was attached to, so the
  // second question arrived with no document and the model disowned its own correct answer.
  it("re-folds a past turn's document, not just the last one", () => {
    const messages = [
      dbMsg(1, "user", "what is the code?"),
      dbMsg(2, "assistant", "IT3600..."),
      dbMsg(3, "user", "which page?"),
    ];
    const withPdf: DbAttachment = {
      ...dbAtt(1, "application/pdf"),
      filename: "invoices.pdf",
      textContent: JSON.stringify({
        pageCount: 1,
        pages: [{ page: 6, text: "Creditor identifier IT3600..." }],
      }),
    };
    const wire = toWireHistory(messages, [withPdf], false);
    expect(wire.messages[0].content).toContain("--- invoices.pdf, page 6 ---");
    expect(wire.messages[0].content).toContain("IT3600...");
    expect(wire.messages[2].content).toBe("which page?");
    expect(wire.isTruncated).toBe(false);
  });

  // The sibling of the document bug: /api/chat keeps no state, so a picture from an earlier turn is invisible unless it
  // is replayed on the turn that carried it.
  it("re-attaches images to the turn they belong to, not just the last", () => {
    const messages = [
      dbMsg(1, "user", "look"),
      dbMsg(2, "assistant", "seen"),
      dbMsg(3, "user", "and now?"),
    ];
    const wire = toWireHistory(messages, [dbAtt(1, "image/png")], true);
    expect(wire.messages[0].images).toEqual(["AQ=="]);
    expect(wire.messages[2].images).toBeUndefined();
  });

  // Silently sending nothing let a text-only model answer as if the picture had never been attached.
  it("sends no images to a model without vision, and says so", () => {
    const wire = toWireHistory([dbMsg(1, "user", "look")], [dbAtt(1, "image/png")], false);
    expect(wire.messages[0].images).toBeUndefined();
    expect(wire.messages[0].content).toContain("this model cannot read images");
  });

  // The pages of a scan rendered under a vision model stay in the DB. Moving the chat to a text-only model must not
  // announce them as lost pictures: the text recognised from them is what this turn carries.
  it("says nothing about the pages it rendered from a document", () => {
    const pdf = {
      ...dbAtt(1, "application/pdf"),
      filename: "scan.pdf",
      textContent: JSON.stringify({
        pageCount: 1,
        pages: [{ page: 1, text: "SCAN-99417", isFromOcr: true }],
      }),
    };
    const rows = [
      pdf,
      { ...dbAtt(1, "image/jpeg"), filename: "scan.pdf (page 1)", derivedFrom: pdf.id },
    ];
    const wire = toWireHistory([dbMsg(1, "user", "read this")], rows, false);
    expect(wire.messages[0].content).toContain("SCAN-99417");
    expect(wire.messages[0].content).not.toContain("cannot read images");
  });

  // A scan attached under a non-vision model persisted no pages, so its emptiness has to keep being explained even after
  // the chat moves to a model that could have seen them.
  it("explains a text-less PDF that has no rendered pages", () => {
    const stored = JSON.stringify({ pageCount: 2, pages: [] });
    const wire = toWireHistory(
      [dbMsg(1, "user", "read this")],
      [{ ...dbAtt(1, "application/pdf"), filename: "scan.pdf", textContent: stored }],
      true,
    );
    expect(wire.messages[0].content).toContain("no text layer");
  });

  it("stays quiet when the pages did get rendered", () => {
    const stored = JSON.stringify({ pageCount: 2, pages: [] });
    const pdf = {
      ...dbAtt(1, "application/pdf"),
      filename: "scan.pdf",
      textContent: stored,
    };
    const rows = [
      pdf,
      {
        ...dbAtt(1, "image/jpeg"),
        filename: "scan.pdf (page 1)",
        derivedFrom: pdf.id,
      },
    ];
    const wire = toWireHistory([dbMsg(1, "user", "read this")], rows, true);
    expect(wire.messages[0].content).not.toContain("no text layer");
  });

  it("leaves a turn alone when its attachment carries no text", () => {
    const messages = [dbMsg(1, "user", "look at this")];
    const wire = toWireHistory(messages, [dbAtt(1, "image/png")], true);
    expect(wire.messages[0].content).toBe("look at this");
  });
});

describe("describePageCuts", () => {
  // One label for two causes told a 12-page scan that only its first 30 pages were read, which never happened.
  it("names the cause that actually happened", () => {
    expect(describePageCuts(new Set(["bytes"]))).toBe(
      "Some pages were too large to send.",
    );
    expect(describePageCuts(new Set(["error"]))).toContain("could not be prepared");
    expect(describePageCuts(new Set(["pages"]))).toContain(
      `first ${PDF_OCR_MAX_PAGES} pages`,
    );
  });

  // The toast clamps its body to two lines, so two reasons have to fit in a description that can still be read.
  it("says both when two documents cut for different reasons, and stays readable", () => {
    const description = describePageCuts(new Set(["error", "pages"]));
    expect(description).toContain(`first ${PDF_OCR_MAX_PAGES} pages`);
    expect(description).toContain("could not be prepared");
    expect(description.length).toBeLessThanOrEqual(80);
  });

  it("says nothing when nothing was cut", () => {
    expect(describePageCuts(new Set())).toBe("");
  });
});

describe("describePickFailures", () => {
  it("names the one file, and why", () => {
    expect(
      describePickFailures([{ filename: "locked.pdf", reason: "password" }]),
    ).toEqual({
      title: "locked.pdf is password protected",
      description: "Quock can't read a locked PDF.",
      tone: "error",
    });
  });

  // Two damaged documents in one send used to fire two toasts, and the store keeps only the last: the first was never
  // named while the model still received an empty placeholder for it.
  it("folds several failures into one notice, counting them all", () => {
    const notice = describePickFailures([
      { filename: "a.pdf", reason: "unreadable" },
      { filename: "b.pdf", reason: "password" },
    ]);
    expect(notice?.title).toBe("2 attachments couldn't be used");
    expect(notice?.description).toBe("a.pdf, b.pdf");
    expect(notice?.tone).toBe("error");
  });

  // The toast body is two lines: eight joined filenames would clip away the part that makes it actionable.
  it("stops naming past the second file and counts the rest", () => {
    const notice = describePickFailures([
      { filename: "a.pdf", reason: "unreadable" },
      { filename: "b.pdf", reason: "password" },
      { filename: "c.jpg", reason: "write" },
      { filename: "d.pdf", reason: "unreadable" },
    ]);
    expect(notice?.title).toBe("4 attachments couldn't be used");
    expect(notice?.description).toBe("a.pdf, b.pdf and 2 more");
  });

  it("stays quiet when every pick made it", () => {
    expect(describePickFailures([])).toBeNull();
  });
});

describe("topNotice", () => {
  // The store is latest-wins, so the password failure used to be wiped by the trim notice that followed it.
  it("keeps the gravest notice, not the newest", () => {
    const notice = topNotice([
      { title: "locked.pdf is password protected", tone: "error" },
      { title: "Document trimmed" },
    ]);
    expect(notice?.title).toBe("locked.pdf is password protected");
  });

  it("keeps the first of equal weight, so the earliest cause is the one shown", () => {
    const notice = topNotice([{ title: "Some pages were left out" }, { title: "Document trimmed" }]);
    expect(notice?.title).toBe("Some pages were left out");
  });

  it("returns null when the send had nothing to say", () => {
    expect(topNotice([])).toBeNull();
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
