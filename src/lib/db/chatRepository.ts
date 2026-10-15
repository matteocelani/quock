// Chat repository: CRUD over the `chats` table plus the join needed to build the sidebar list.

import type { SQLiteDatabase } from "expo-sqlite";
import {
  asAttachmentId,
  asChatId,
  asMessageId,
  type AttachmentId,
  type ChatId,
  type MessageId,
  newChatId,
} from "@/lib/types/ids";
import {
  EXCERPT_LENGTH,
  WEB_SEARCH_DEFAULT_ON,
} from "@/lib/constants/magic-numbers";
import type { ChatSummary, DbChat } from "@/lib/db/types";

interface ChatRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
  model: string | null;
  think_enabled: number;
  web_search_enabled: number;
}

interface IdRow {
  id: number;
}

type AttachmentCopy = readonly [source: AttachmentId, copy: AttachmentId];

// Owner of a fork still being copied: no account lists it, and boot sweeps whatever a killed app left behind.
const FORK_IN_PROGRESS_USER = "quock:fork-in-progress";

interface ChatSummaryRow {
  id: string;
  title: string;
  updated_at: number;
  excerpt: string | null;
  size_bytes: number | null;
}

function rowToChat(row: ChatRow): DbChat {
  return {
    id: asChatId(row.id),
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
    model: row.model,
    thinkEnabled: row.think_enabled === 1,
    webSearchEnabled: row.web_search_enabled === 1,
  };
}

export class ChatRepository {
  // Every query is scoped to getUserId() (the signed-in account id, "" when signed out) so one device's accounts
  // never see each other's local chats; injected by DbProvider and read live per-call, so sign-in/out needs no rebuild.
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly getUserId: () => string,
  ) {}
  // Returns chats most-recently-updated first; excerpt is the FIRST user message so the row reads as the chat's stable topic identity rather than its latest reply. `size_bytes` aggregates SQLite-side so we never round-trip per row.
  async list(): Promise<ChatSummary[]> {
    const userId = this.getUserId();
    const rows = await this.db.getAllAsync<ChatSummaryRow>(
      `
      SELECT
        c.id          AS id,
        c.title       AS title,
        c.updated_at  AS updated_at,
        (
          SELECT m.content
          FROM messages m
          WHERE m.chat_id = c.id AND m.role = 'user'
          ORDER BY m.created_at ASC, m.id ASC
          LIMIT 1
        )             AS excerpt,
        (
        -- LENGTH() counts characters on TEXT and bytes on BLOB, so the cast is what makes every figure bytes.
          SELECT COALESCE(SUM(LENGTH(CAST(m.content AS BLOB))) + SUM(COALESCE(LENGTH(CAST(m.thinking AS BLOB)), 0)), 0)
          FROM messages m
          WHERE m.chat_id = c.id
        )
        +
        (
          SELECT COALESCE(SUM(LENGTH(a.data)) + SUM(COALESCE(LENGTH(CAST(a.text_content AS BLOB)), 0)), 0)
          FROM attachments a
          JOIN messages m ON a.message_id = m.id
          WHERE m.chat_id = c.id
        )             AS size_bytes
      FROM chats c
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
      `,
      [userId],
    );
    return rows.map((row) => ({
      id: asChatId(row.id),
      title: row.title,
      updatedAt: row.updated_at,
      excerpt: (row.excerpt ?? "").slice(0, EXCERPT_LENGTH),
      sizeBytes: row.size_bytes ?? 0,
    }));
  }
  // Aggregates total bytes across all chats — used by the "Clear all chats" confirm dialog so the user sees how much storage they will free. A single scan, no per-chat round-trip.
  async getTotalSize(): Promise<number> {
    const userId = this.getUserId();
    const row = await this.db.getFirstAsync<{ total: number | null }>(
      `
      SELECT
        (
        -- LENGTH() counts characters on TEXT and bytes on BLOB, so the cast is what makes every figure bytes.
          SELECT COALESCE(SUM(LENGTH(CAST(m.content AS BLOB))) + SUM(COALESCE(LENGTH(CAST(m.thinking AS BLOB)), 0)), 0)
          FROM messages m
          JOIN chats c ON m.chat_id = c.id
          WHERE c.user_id = ?
        )
        +
        (
          SELECT COALESCE(SUM(LENGTH(a.data)) + SUM(COALESCE(LENGTH(CAST(a.text_content AS BLOB)), 0)), 0)
          FROM attachments a
          JOIN messages m ON a.message_id = m.id
          JOIN chats c ON m.chat_id = c.id
          WHERE c.user_id = ?
        )       AS total
      `,
      [userId, userId],
    );
    return row?.total ?? 0;
  }
  // Device-wide total across EVERY account's chats — shown on the "clear all data" confirm so the user sees how much a full wipe frees. Unscoped on purpose (getTotalSize above is the per-account figure).
  async getDeviceTotalSize(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number | null }>(
      `
      SELECT
        (
        -- LENGTH() counts characters on TEXT and bytes on BLOB, so the cast is what makes every figure bytes.
          SELECT COALESCE(SUM(LENGTH(CAST(content AS BLOB))) + SUM(COALESCE(LENGTH(CAST(thinking AS BLOB)), 0)), 0)
          FROM messages
        )
        +
        (
          SELECT COALESCE(SUM(LENGTH(data)) + SUM(COALESCE(LENGTH(CAST(text_content AS BLOB)), 0)), 0)
          FROM attachments
        )       AS total
      `,
    );
    return row?.total ?? 0;
  }
  // Wipes EVERY account's chats on this device (storage reclaim / handoff), bypassing the per-account scope. Child-first deletes in a transaction so it reclaims fully regardless of the runtime foreign-keys pragma.
  async clearAllDevice(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync("DELETE FROM attachments");
      await this.db.execAsync("DELETE FROM messages");
      await this.db.execAsync("DELETE FROM chats");
    });
    // Outside the transaction, where VACUUM is allowed: this is the flow whose whole purpose is freeing the disk.
    await this.reclaimSpace();
  }
  async get(id: ChatId): Promise<DbChat | null> {
    const userId = this.getUserId();
    const row = await this.db.getFirstAsync<ChatRow>(
      "SELECT id, title, created_at, updated_at, synced_at, model, think_enabled, web_search_enabled FROM chats WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    return row ? rowToChat(row) : null;
  }
  async create(title?: string): Promise<DbChat> {
    const id = newChatId();
    const now = Date.now();
    const resolvedTitle = title ?? "";
    const userId = this.getUserId();
    // model NULL follows the user's global default; think off lets the model's own default apply.
    // user_id scopes the chat to the signed-in account.
    await this.db.runAsync(
      "INSERT INTO chats (id, user_id, title, created_at, updated_at, synced_at, model, think_enabled, web_search_enabled) VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, ?)",
      [id, userId, resolvedTitle, now, now, WEB_SEARCH_DEFAULT_ON ? 1 : 0],
    );
    return {
      id,
      title: resolvedTitle,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
      model: null,
      thinkEnabled: false,
      webSearchEnabled: true,
    };
  }
  // The source's turns up to `upToMessageId`, with its model and toggles, as plain statements: a shared BEGIN lets other
  // chats' writes join it and an exclusive one locks them out. A failed copy deletes its own chat instead.
  async fork(
    sourceId: ChatId,
    upToMessageId: MessageId,
    title: string,
  ): Promise<ChatId> {
    const id = newChatId();
    const now = Date.now();
    const userId = this.getUserId();
    const created = await this.db.runAsync(
      "INSERT INTO chats (id, user_id, title, created_at, updated_at, synced_at, model, think_enabled, web_search_enabled) SELECT ?, ?, ?, ?, ?, NULL, model, think_enabled, web_search_enabled FROM chats WHERE id = ? AND user_id = ?",
      [id, FORK_IN_PROGRESS_USER, title, now, now, sourceId, userId],
    );
    if (created.changes === 0) {
      throw new Error("ChatRepository.fork: source chat not found");
    }
    try {
      await this.copyTurns(sourceId, upToMessageId, id);
      await this.db.runAsync("UPDATE chats SET user_id = ? WHERE id = ?", [
        userId,
        id,
      ]);
    } catch (err) {
      // Messages and attachments cascade with the chat, so one delete leaves no half-copied fork behind.
      await this.delete(id).catch((cleanupErr: unknown) => {
        console.warn("ChatRepository.fork: cleanup failed", cleanupErr);
      });
      throw new Error("ChatRepository.fork: copy failed", { cause: err });
    }
    return id;
  }
  // Every column is copied as stored, timestamps included, so the fork replays and sorts exactly like its source.
  private async copyTurns(
    sourceId: ChatId,
    upToMessageId: MessageId,
    forkId: ChatId,
  ): Promise<void> {
    const sourceMessages = await this.db.getAllAsync<IdRow>(
      "SELECT id FROM messages WHERE chat_id = ? AND id <= ? ORDER BY id ASC",
      [sourceId, upToMessageId],
    );
    // A reply regenerated away before the copy began would otherwise yield a fork ending on an unanswered question.
    if (sourceMessages.at(-1)?.id !== upToMessageId) {
      throw new Error("ChatRepository.fork: fork point not found");
    }
    let copiedAttachments: readonly AttachmentCopy[] = [];
    for (const message of sourceMessages) {
      const sourceMessageId = asMessageId(message.id);
      const copiedMessage = await this.db.runAsync(
        "INSERT INTO messages (chat_id, role, content, thinking, model, created_at, updated_at, thinking_time_start, thinking_time_end, status, error_code, web_search_failed, sent_with_think, sent_with_web_search, read_web) SELECT ?, role, content, thinking, model, created_at, updated_at, thinking_time_start, thinking_time_end, status, error_code, web_search_failed, sent_with_think, sent_with_web_search, read_web FROM messages WHERE id = ?",
        [forkId, sourceMessageId],
      );
      // A turn deleted mid-copy (a regenerate tapped meanwhile) copies nothing; failing beats a fork with a hole in it.
      if (copiedMessage.changes !== 1) {
        throw new Error("ChatRepository.fork: a source message vanished");
      }
      const copiedMessageId = asMessageId(copiedMessage.lastInsertRowId);
      const sourceAttachments = await this.db.getAllAsync<IdRow>(
        "SELECT id FROM attachments WHERE message_id = ? ORDER BY id ASC",
        [sourceMessageId],
      );
      for (const attachment of sourceAttachments) {
        const copiedAttachment = await this.db.runAsync(
          "INSERT INTO attachments (message_id, filename, mime_type, data, uri, size_bytes, text_content, derived_from) SELECT ?, filename, mime_type, data, uri, size_bytes, text_content, derived_from FROM attachments WHERE id = ?",
          [copiedMessageId, attachment.id],
        );
        if (copiedAttachment.changes !== 1) {
          throw new Error("ChatRepository.fork: a source attachment vanished");
        }
        copiedAttachments = [
          ...copiedAttachments,
          [
            asAttachmentId(attachment.id),
            asAttachmentId(copiedAttachment.lastInsertRowId),
          ],
        ];
      }
    }
    // A rendered PDF page still names its source's document; point it at the fork's copy, or the page would be orphaned.
    for (const [sourceAttachmentId, copyId] of copiedAttachments) {
      await this.db.runAsync(
        "UPDATE attachments SET derived_from = ? WHERE derived_from = ? AND message_id IN (SELECT id FROM messages WHERE chat_id = ?)",
        [copyId, sourceAttachmentId, forkId],
      );
    }
  }
  // Drops forks whose copy never finished (the app died mid-copy); their rows cascade with them.
  async deleteUnfinishedForks(): Promise<void> {
    await this.db.runAsync("DELETE FROM chats WHERE user_id = ?", [
      FORK_IN_PROGRESS_USER,
    ]);
  }
  // Pins a model to this chat so it persists across restarts and stays scoped to this chat alone. We deliberately do NOT touch updated_at: changing the model isn't conversational activity and shouldn't reorder the history list.
  async setModel(id: ChatId, model: string): Promise<void> {
    await this.db.runAsync("UPDATE chats SET model = ? WHERE id = ?", [
      model,
      id,
    ]);
  }
  // Locks in the model the conversation started on (first send) via an atomic `WHERE model IS NULL` guard, so it never clobbers an explicit pick and the chat stops tracking later global-default changes.
  async setModelIfUnset(id: ChatId, model: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE chats SET model = ? WHERE id = ? AND model IS NULL",
      [model, id],
    );
  }
  // Persist this chat's sticky composer toggles. Like setModel, we deliberately do NOT touch updated_at: flipping a mode isn't conversational activity and shouldn't reorder the history list.
  async setThinkEnabled(id: ChatId, enabled: boolean): Promise<void> {
    await this.db.runAsync("UPDATE chats SET think_enabled = ? WHERE id = ?", [
      enabled ? 1 : 0,
      id,
    ]);
  }
  async setWebSearchEnabled(id: ChatId, enabled: boolean): Promise<void> {
    await this.db.runAsync(
      "UPDATE chats SET web_search_enabled = ? WHERE id = ?",
      [enabled ? 1 : 0, id],
    );
  }
  async rename(id: ChatId, title: string): Promise<void> {
    const now = Date.now();
    await this.db.runAsync(
      "UPDATE chats SET title = ?, updated_at = ? WHERE id = ?",
      [title, now, id],
    );
  }
  // SQLite hands deleted pages to a freelist inside the file, so only VACUUM returns them to the filesystem. Public so
  // a caller deleting many chats in a loop can reclaim ONCE at the end: this rewrites the whole file.
  async reclaimSpace(): Promise<void> {
    await this.db.execAsync("VACUUM;");
  }
  async delete(id: ChatId): Promise<void> {
    await this.db.runAsync("DELETE FROM chats WHERE id = ?", [id]);
  }
  // Removes chats that never received a single message. `keepId` excludes the user's currently-open chat so we don't delete the row the Composer is about to append messages to (FK violation).
  async deleteEmpty(keepId?: ChatId): Promise<number> {
    const userId = this.getUserId();
    if (keepId !== undefined) {
      const result = await this.db.runAsync(
        "DELETE FROM chats WHERE user_id = ? AND id != ? AND NOT EXISTS (SELECT 1 FROM messages WHERE chat_id = chats.id)",
        [userId, keepId],
      );
      return result.changes;
    }
    const result = await this.db.runAsync(
      "DELETE FROM chats WHERE user_id = ? AND NOT EXISTS (SELECT 1 FROM messages WHERE chat_id = chats.id)",
      [userId],
    );
    return result.changes;
  }
  async touchUpdated(id: ChatId): Promise<void> {
    const now = Date.now();
    await this.db.runAsync("UPDATE chats SET updated_at = ? WHERE id = ?", [
      now,
      id,
    ]);
  }
}
