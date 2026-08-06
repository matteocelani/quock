// Attachment repository: stores file blobs against a message.

import type { SQLiteDatabase } from "expo-sqlite";
import {
  asAttachmentId,
  asMessageId,
  type AttachmentId,
  type ChatId,
  type MessageId,
} from "@/lib/types/ids";
import type { DbAttachment } from "@/lib/db/types";

interface AttachmentRow {
  id: number;
  message_id: number;
  filename: string;
  mime_type: string | null;
  data: Uint8Array;
  uri: string | null;
  size_bytes: number;
  text_content: string | null;
  derived_from: number | null;
}

function rowToAttachment(row: AttachmentRow): DbAttachment {
  return {
    id: asAttachmentId(row.id),
    messageId: asMessageId(row.message_id),
    filename: row.filename,
    mimeType: row.mime_type,
    data: row.data,
    uri: row.uri,
    sizeBytes: row.size_bytes,
    textContent: row.text_content,
    derivedFrom:
      row.derived_from === null ? null : asAttachmentId(row.derived_from),
  };
}
// Add input lets callers omit `uri`, `sizeBytes` and `textContent`; sizeBytes defaults to `data.byteLength`.
export type AttachmentAddInput = Omit<
  DbAttachment,
  "id" | "uri" | "sizeBytes" | "textContent" | "derivedFrom"
> &
  Partial<
    Pick<DbAttachment, "uri" | "sizeBytes" | "textContent" | "derivedFrom">
  >;

export class AttachmentRepository {
  constructor(private readonly db: SQLiteDatabase) {}
  async listByMessage(messageId: MessageId): Promise<DbAttachment[]> {
    const rows = await this.db.getAllAsync<AttachmentRow>(
      `
      SELECT id, message_id, filename, mime_type, data, uri, size_bytes, text_content, derived_from
      FROM attachments
      WHERE message_id = ?
      ORDER BY id ASC
      `,
      [messageId],
    );
    return rows.map(rowToAttachment);
  }
  // Every attachment of a chat in ONE query, for building the wire: a query per message would put a round-trip on every
  // turn. `data` comes back EMPTY for a row that stores its text (a PDF), whose blob the wire never sends — loading up
  // to 20 MB per document on every turn would be pure read amplification. Not for the UI, which needs the real bytes.
  async listByChatForWire(chatId: ChatId): Promise<DbAttachment[]> {
    const rows = await this.db.getAllAsync<AttachmentRow>(
      `
      SELECT a.id, a.message_id, a.filename, a.mime_type, a.uri, a.size_bytes, a.text_content, a.derived_from,
             CASE WHEN a.text_content IS NULL THEN a.data ELSE x'' END AS data
      FROM attachments a
      JOIN messages m ON m.id = a.message_id
      WHERE m.chat_id = ?
      ORDER BY a.id ASC
      `,
      [chatId],
    );
    return rows.map(rowToAttachment);
  }
  async add(input: AttachmentAddInput): Promise<DbAttachment> {
    const uri = input.uri ?? null;
    const sizeBytes = input.sizeBytes ?? input.data.byteLength;
    const textContent = input.textContent ?? null;
    const derivedFrom = input.derivedFrom ?? null;
    const result = await this.db.runAsync(
      `
      INSERT INTO attachments (message_id, filename, mime_type, data, uri, size_bytes, text_content, derived_from)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.messageId,
        input.filename,
        input.mimeType,
        input.data,
        uri,
        sizeBytes,
        textContent,
        derivedFrom,
      ],
    );
    return {
      ...input,
      id: asAttachmentId(result.lastInsertRowId),
      uri,
      sizeBytes,
      textContent,
      derivedFrom,
    };
  }
  async delete(id: AttachmentId): Promise<void> {
    await this.db.runAsync("DELETE FROM attachments WHERE id = ?", [id]);
  }
}
