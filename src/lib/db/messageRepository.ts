// Message repository: append/update/delete operations on the `messages` table. All queries are parameterised.

import type { SQLiteDatabase } from "expo-sqlite";
import {
  asChatId,
  asMessageId,
  type ChatId,
  type MessageId,
} from "@/lib/types/ids";
import type {
  DbMessage,
  MessageErrorCode,
  MessageRole,
  MessageStatus,
} from "@/lib/db/types";

interface MessageRow {
  id: number;
  chat_id: string;
  role: string;
  content: string;
  thinking: string | null;
  model: string | null;
  created_at: number;
  updated_at: number;
  thinking_time_start: number | null;
  thinking_time_end: number | null;
  status: string;
  error_code: string | null;
  web_search_failed: number;
  sent_with_think: number;
  sent_with_web_search: number;
}

function rowToMessage(row: MessageRow): DbMessage {
  return {
    id: asMessageId(row.id),
    chatId: asChatId(row.chat_id),
    role: row.role as MessageRole,
    content: row.content,
    thinking: row.thinking,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    thinkingTimeStart: row.thinking_time_start,
    thinkingTimeEnd: row.thinking_time_end,
    status: row.status as MessageStatus,
    errorCode: row.error_code as MessageErrorCode | null,
    webSearchFailed: row.web_search_failed === 1,
    sentWithThink: row.sent_with_think === 1,
    sentWithWebSearch: row.sent_with_web_search === 1,
  };
}
// Whitelist used by `update()` so nothing user-controlled ever reaches the raw SQL string.
const UPDATABLE_COLUMNS: Record<
  Exclude<keyof DbMessage, "id" | "chatId">,
  string
> = {
  role: "role",
  content: "content",
  thinking: "thinking",
  model: "model",
  createdAt: "created_at",
  updatedAt: "updated_at",
  thinkingTimeStart: "thinking_time_start",
  thinkingTimeEnd: "thinking_time_end",
  status: "status",
  errorCode: "error_code",
  webSearchFailed: "web_search_failed",
  sentWithThink: "sent_with_think",
  sentWithWebSearch: "sent_with_web_search",
};
// Append input lets callers omit lifecycle/derived columns; the repo defaults `status='complete'`, `errorCode=null`, and all the boolean flags to false.
export type MessageAppendInput = Omit<
  DbMessage,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "status"
  | "errorCode"
  | "webSearchFailed"
  | "sentWithThink"
  | "sentWithWebSearch"
> &
  Partial<
    Pick<
      DbMessage,
      | "status"
      | "errorCode"
      | "webSearchFailed"
      | "sentWithThink"
      | "sentWithWebSearch"
    >
  >;

export class MessageRepository {
  constructor(private readonly db: SQLiteDatabase) {}
  async listByChat(chatId: ChatId): Promise<DbMessage[]> {
    const rows = await this.db.getAllAsync<MessageRow>(
      `
      SELECT id, chat_id, role, content, thinking, model, created_at,
             updated_at, thinking_time_start, thinking_time_end,
             status, error_code, web_search_failed,
             sent_with_think, sent_with_web_search
      FROM messages
      WHERE chat_id = ?
      ORDER BY created_at ASC, id ASC
      `,
      [chatId],
    );
    return rows.map(rowToMessage);
  }
  async append(input: MessageAppendInput): Promise<DbMessage> {
    const now = Date.now();
    const status: MessageStatus = input.status ?? "complete";
    const errorCode: MessageErrorCode | null = input.errorCode ?? null;
    const webSearchFailed: boolean = input.webSearchFailed ?? false;
    const sentWithThink: boolean = input.sentWithThink ?? false;
    const sentWithWebSearch: boolean = input.sentWithWebSearch ?? false;
    const result = await this.db.runAsync(
      `
      INSERT INTO messages (
        chat_id, role, content, thinking, model,
        created_at, updated_at,
        thinking_time_start, thinking_time_end,
        status, error_code, web_search_failed,
        sent_with_think, sent_with_web_search
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.chatId,
        input.role,
        input.content,
        input.thinking,
        input.model,
        now,
        now,
        input.thinkingTimeStart,
        input.thinkingTimeEnd,
        status,
        errorCode,
        webSearchFailed ? 1 : 0,
        sentWithThink ? 1 : 0,
        sentWithWebSearch ? 1 : 0,
      ],
    );
    return {
      ...input,
      id: asMessageId(result.lastInsertRowId),
      createdAt: now,
      updatedAt: now,
      status,
      errorCode,
      webSearchFailed,
      sentWithThink,
      sentWithWebSearch,
    };
  }
  async update(
    id: MessageId,
    patch: Partial<Omit<DbMessage, "id" | "chatId">>,
  ): Promise<void> {
    const assignments: string[] = [];
    const values: (string | number | null)[] = [];
    // TS limitation: Object.keys lacks key-narrowing.
    for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
      const column = UPDATABLE_COLUMNS[key];
      if (!column) {
        continue;
      }

      const value = patch[key];
      if (value === undefined) {
        continue;
      }
      assignments.push(`${column} = ?`);
      // SQLite has no boolean type; persist flags (e.g. webSearchFailed) as 0/1.
      values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
    }
    if (assignments.length === 0) {
      return;
    }
    // Always bump updated_at; an explicit value in the patch wins because it is appended first above.
    if (patch.updatedAt === undefined) {
      assignments.push("updated_at = ?");
      values.push(Date.now());
    }
    values.push(id);
    await this.db.runAsync(
      `UPDATE messages SET ${assignments.join(", ")} WHERE id = ?`,
      values,
    );
  }
  async delete(id: MessageId): Promise<void> {
    await this.db.runAsync("DELETE FROM messages WHERE id = ?", [id]);
  }
  // Used by "regenerate from this message": removes every message in the chat with id strictly greater than `afterId`.
  async deleteAfter(chatId: ChatId, afterId: MessageId): Promise<void> {
    await this.db.runAsync(
      "DELETE FROM messages WHERE chat_id = ? AND id > ?",
      [chatId, afterId],
    );
  }
}
