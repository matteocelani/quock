// Shared turn-building steps for the send / regenerate / retry / editAndResend paths in `useSendMessage`, kept
// React-free and module-level so the four paths share one implementation each and can be unit-tested without the hook.

import type { QueryClient } from "@tanstack/react-query";
import type { ChatRepository } from "@/lib/db/chatRepository";
import type { DbAttachment, DbMessage } from "@/lib/db/types";
import { queryKeys } from "@/lib/hooks/queryKeys";
import type { ToastTone } from "@/lib/stores/toast.store";
import type { ChatId, MessageId } from "@/lib/types/ids";
import type { WireChatMessage } from "@/modules/chat/api/chat";
import type { UseChatData } from "@/modules/chat/hooks/useChat";
import { attachmentTextBlocks } from "@/modules/chat/lib/attachmentText";
import { encodeAttachmentBase64 } from "@/modules/chat/lib/attachmentBase64";
import {
  ATTACHMENT_REPLAY_MAX_BYTES,
  PDF_OCR_MAX_PAGES,
  TOAST_MAX_NAMED_FILES,
} from "@/modules/chat/constants";
import {
  allocateBlocks,
  foldBlocks,
  type TextBlockInput,
} from "@/modules/chat/lib/documentText";

// Drops image attachments when the active model lacks vision so unsupported blobs never reach the DB write
// or the wire payload. Generic over Ui/Db attachment rows — both carry a `mimeType`.
export function gateVisionAttachments<T extends { mimeType?: string | null }>(
  rows: T[],
  hasVision: boolean,
): T[] {
  if (hasVision) return rows;
  return rows.filter((a) => a.mimeType?.startsWith("image/") !== true);
}

export interface WireHistory {
  messages: WireChatMessage[];
  // Set when the budget forced a document to be cut, so the caller can say so instead of shipping a silent gap.
  isTruncated: boolean;
}

// Three unrelated reasons a scan can lose pages, kept apart because one toast claiming the wrong one is worse than no
// toast: the page cap is a design limit, the byte budget depends on the rest of the message, an error is a bug.
export type PageCutCause = "pages" | "bytes" | "error";

// Kept short on purpose: the toast body is clamped to two lines, so a long sentence would clip the one after it.
const CUT_REASONS: readonly (readonly [PageCutCause, string])[] = [
  ["pages", `Only the first ${PDF_OCR_MAX_PAGES} pages of a scan are read.`],
  ["bytes", "Some pages were too large to send."],
  ["error", "Some pages could not be prepared."],
];

// One sentence per cause that actually happened, in the order above. Two documents in one turn can cut for two reasons.
export function describePageCuts(causes: ReadonlySet<PageCutCause>): string {
  return CUT_REASONS.filter(([cause]) => causes.has(cause))
    .map(([, text]) => text)
    .join(" ");
}

export interface SendNotice {
  title: string;
  description?: string;
  tone?: ToastTone;
}

const TONE_RANK: Record<ToastTone, number> = {
  error: 3,
  warning: 2,
  success: 1,
  info: 0,
};

// Why a picked file never made it into the turn. `write` is the row itself failing, which costs the attachment entirely.
export type PickFailureReason = "password" | "unreadable" | "write";

export interface PickFailure {
  filename: string;
  reason: PickFailureReason;
}

const PICK_FAILURE_TEXT: Record<PickFailureReason, string> = {
  password: "Quock can't read a locked PDF.",
  unreadable: "The file is damaged, or it is not really a PDF.",
  // Says nothing about the message itself: whatever stopped the row from being written usually stops the send too.
  write: "It couldn't be saved with the message.",
};

// One notice for every file that did not make it, because the store keeps only the last: two damaged documents in one
// send used to bury each other, and the first was never named while the model got an empty placeholder for it.
export function describePickFailures(
  failures: readonly PickFailure[],
): SendNotice | null {
  if (failures.length === 0) return null;
  if (failures.length === 1) {
    const only = failures[0];
    return {
      title:
        only.reason === "password"
          ? `${only.filename} is password protected`
          : `${only.filename} couldn't be used`,
      description: PICK_FAILURE_TEXT[only.reason],
      tone: "error",
    };
  }
  // Only the first names: the toast body is two lines, and eight joined filenames would clip away the very part that
  // makes it actionable. The count in the title always survives.
  const named = failures
    .slice(0, TOAST_MAX_NAMED_FILES)
    .map((f) => f.filename)
    .join(", ");
  const rest = failures.length - TOAST_MAX_NAMED_FILES;
  return {
    title: `${failures.length} attachments couldn't be used`,
    description: rest > 0 ? `${named} and ${rest} more` : named,
    tone: "error",
  };
}

// The toast store is latest-wins, so a send with more than one thing to say leaves only the last notice on screen — and
// the gravest (a document that could not be read at all) is the first to fire. Say the worst one instead of the newest.
export function topNotice(notices: readonly SendNotice[]): SendNotice | null {
  let top: SendNotice | null = null;
  for (const notice of notices) {
    const rank = TONE_RANK[notice.tone ?? "info"];
    if (top === null || rank > TONE_RANK[top.tone ?? "info"]) top = notice;
  }
  return top;
}

// Named by count, not by file: the note stands for pictures the turn had and the model will not get.
function imageNote(count: number, text: string): TextBlockInput {
  return { filename: `${count} image${count > 1 ? "s" : ""}`, text };
}

// Maps persisted rows to the stateless `/api/chat` conversation, re-folding each user turn's documents from its rows.
// Folding only the turn being sent left a document invisible from the second question on.
export function toWireHistory(
  messages: readonly DbMessage[],
  attachmentRows: readonly DbAttachment[] = [],
  hasVision = false,
): WireHistory {
  const turns = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  const rowsOf = (m: DbMessage): DbAttachment[] =>
    m.role === "user" ? attachmentRows.filter((a) => a.messageId === m.id) : [];
  const groups = turns.map((m) => {
    const rows = rowsOf(m);
    // A rendered page points back at the document it came from, so a PDF knows whether its pages made it.
    return rows.flatMap((a) =>
      attachmentTextBlocks(
        a,
        rows.some((p) => p.derivedFrom === a.id),
      ),
    );
  });
  // Images ride each user turn, not only the last one: /api/chat is stateless, so a picture attached three questions ago
  // is gone from the model's view unless it is replayed. Newest first, since the byte budget bounds the whole payload.
  let imageBudget = ATTACHMENT_REPLAY_MAX_BYTES;
  const imagesPerTurn = new Array<string[]>(turns.length).fill([]);
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const images: string[] = [];
    let dropped = 0;
    let unseen = 0;
    for (const row of rowsOf(turns[i])) {
      if (row.mimeType?.startsWith("image/") !== true) continue;
      // A chat that moves to a text-only model keeps its pictures in the DB; the note is the only thing left to send. A
      // page rendered from a document is not one of them: its text rides this turn, so counting it would invent a loss.
      if (!hasVision) {
        if (row.derivedFrom === null) unseen += 1;
        continue;
      }
      if (row.data.byteLength > imageBudget) {
        dropped += 1;
        continue;
      }
      imageBudget -= row.data.byteLength;
      images.push(encodeAttachmentBase64(row.id, row.data));
    }
    // Said out loud for the same reason a cut document is: a turn asking about a picture the model cannot see is worse
    // than a turn that admits the picture is missing.
    const notes: TextBlockInput[] = [];
    if (dropped > 0) {
      notes.push(
        imageNote(
          dropped,
          "[... not sent: the image budget went to more recent messages ...]",
        ),
      );
    }
    if (unseen > 0) {
      notes.push(
        imageNote(unseen, "[... not sent: this model cannot read images ...]"),
      );
    }
    if (notes.length > 0) groups[i] = [...(groups[i] ?? []), ...notes];
    imagesPerTurn[i] = images;
  }
  const allocated = allocateBlocks(groups);
  return {
    messages: turns.map((m, i) => {
      const wire: WireChatMessage = {
        role: m.role as "user" | "assistant",
        content: foldBlocks(m.content, allocated.groups[i] ?? []),
      };
      const images = imagesPerTurn[i];
      return images.length > 0 ? { ...wire, images } : wire;
    }),
    isTruncated: allocated.isTruncated,
  };
}

// Locates an assistant turn and its preceding user turn, validating both. Shared by regenerate + retry;
// `context` prefixes the thrown messages so a failure still says which path raised it.
export function locateAssistantTurn(
  dbMessages: DbMessage[],
  assistantMessageId: MessageId,
  context: string,
): { assistantIndex: number; priorUser: DbMessage } {
  const assistantIndex = dbMessages.findIndex(
    (m) => m.id === assistantMessageId && m.role === "assistant",
  );
  if (assistantIndex <= 0) {
    throw new Error(`${context}: assistant message not found`);
  }
  const priorUser = dbMessages[assistantIndex - 1];
  if (priorUser.role !== "user") {
    throw new Error(`${context}: no preceding user message`);
  }
  return { assistantIndex, priorUser };
}

// Rebuilds the cache's per-message attachment map after a tail drop: keep only entries whose message survives,
// then re-assert one turn's attachments from the DB (skipped when empty) so its chips survive a cold cache.
export function pruneAttachmentMap(
  existing: UseChatData | undefined,
  keptMessages: DbMessage[],
  reassert: { messageId: MessageId; rows: DbAttachment[] },
): Map<MessageId, DbAttachment[]> {
  const keptIds = new Set(keptMessages.map((m) => m.id));
  const pruned = new Map<MessageId, DbAttachment[]>(
    [...(existing?.attachmentsByMessage ?? [])].filter(([id]) =>
      keptIds.has(id),
    ),
  );
  if (reassert.rows.length > 0) {
    pruned.set(reassert.messageId, reassert.rows);
  }
  return pruned;
}

// Writes the optimistic per-chat cache for a turn: reuse the already-loaded chat metadata, or hydrate it from
// the DB row on a cold cache. One coherence point shared by send / regenerate / retry / editAndResend.
export async function patchChatCache(
  queryClient: QueryClient,
  chats: ChatRepository,
  chatId: ChatId,
  existing: UseChatData | undefined,
  updatedMessages: DbMessage[],
  attachmentsByMessage: Map<MessageId, DbAttachment[]>,
): Promise<void> {
  const chat = existing?.chat ?? (await chats.get(chatId));
  if (!chat) return;
  queryClient.setQueryData<UseChatData>(queryKeys.chat(chatId), {
    chat,
    messages: updatedMessages,
    attachmentsByMessage,
  });
}

// After a turn mutation: float the chat to the top of the sidebar (touch its updatedAt) and refresh the list
// query so the new order/title shows without waiting for staleTime.
export async function bumpSidebar(
  chats: ChatRepository,
  queryClient: QueryClient,
  chatId: ChatId,
): Promise<void> {
  await chats.touchUpdated(chatId);
  void queryClient.invalidateQueries({ queryKey: queryKeys.chats() });
}
