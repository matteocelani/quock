// Chat repository: CRUD over the `chats` table plus the join needed to build the sidebar list.

import type { SQLiteDatabase } from "expo-sqlite";
import { asChatId, type ChatId, newChatId } from "@/lib/types/ids";
import { EXCERPT_LENGTH } from "@/lib/constants/magic-numbers";
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
  constructor(private readonly db: SQLiteDatabase) {}
  // Returns chats most-recently-updated first; excerpt is the FIRST user message so the row reads as the chat's stable topic identity rather than its latest reply. `size_bytes` aggregates SQLite-side so we never round-trip per row.
  async list(): Promise<ChatSummary[]> {
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
          SELECT COALESCE(SUM(LENGTH(m.content)) + SUM(COALESCE(LENGTH(m.thinking), 0)), 0)
          FROM messages m
          WHERE m.chat_id = c.id
        )
        +
        (
          SELECT COALESCE(SUM(LENGTH(a.data)), 0)
          FROM attachments a
          JOIN messages m ON a.message_id = m.id
          WHERE m.chat_id = c.id
        )             AS size_bytes
      FROM chats c
      ORDER BY c.updated_at DESC
      `,
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
    const row = await this.db.getFirstAsync<{ total: number | null }>(
      `
      SELECT
        (
          SELECT COALESCE(SUM(LENGTH(content)) + SUM(COALESCE(LENGTH(thinking), 0)), 0)
          FROM messages
        )
        +
        (
          SELECT COALESCE(SUM(LENGTH(data)), 0)
          FROM attachments
        )       AS total
      `,
    );
    return row?.total ?? 0;
  }
  async get(id: ChatId): Promise<DbChat | null> {
    const row = await this.db.getFirstAsync<ChatRow>(
      "SELECT id, title, created_at, updated_at, synced_at, model, think_enabled, web_search_enabled FROM chats WHERE id = ?",
      [id],
    );
    return row ? rowToChat(row) : null;
  }
  async create(title?: string): Promise<DbChat> {
    const id = newChatId();
    const now = Date.now();
    const resolvedTitle = title ?? "";
    // model is left NULL so a new chat follows the user's global default until they pin one; mode toggles default off (0).
    await this.db.runAsync(
      "INSERT INTO chats (id, title, created_at, updated_at, synced_at, model, think_enabled, web_search_enabled) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0)",
      [id, resolvedTitle, now, now],
    );
    return {
      id,
      title: resolvedTitle,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
      model: null,
      thinkEnabled: false,
      webSearchEnabled: false,
    };
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
  async delete(id: ChatId): Promise<void> {
    await this.db.runAsync("DELETE FROM chats WHERE id = ?", [id]);
  }
  // Removes chats that never received a single message. `keepId` excludes the user's currently-open chat so we don't delete the row the Composer is about to append messages to (FK violation).
  async deleteEmpty(keepId?: ChatId): Promise<number> {
    if (keepId !== undefined) {
      const result = await this.db.runAsync(
        "DELETE FROM chats WHERE id != ? AND NOT EXISTS (SELECT 1 FROM messages WHERE chat_id = chats.id)",
        [keepId],
      );
      return result.changes;
    }
    const result = await this.db.runAsync(
      "DELETE FROM chats WHERE NOT EXISTS (SELECT 1 FROM messages WHERE chat_id = chats.id)",
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
