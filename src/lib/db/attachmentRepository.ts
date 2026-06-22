// Attachment repository: stores file blobs against a message.

import type { SQLiteDatabase } from "expo-sqlite";
import {
  asAttachmentId,
  asMessageId,
  type AttachmentId,
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
  };
}
// Add input lets callers omit `uri` and `sizeBytes`; sizeBytes defaults to `data.byteLength`.
export type AttachmentAddInput = Omit<
  DbAttachment,
  "id" | "uri" | "sizeBytes"
> &
  Partial<Pick<DbAttachment, "uri" | "sizeBytes">>;

export class AttachmentRepository {
  constructor(private readonly db: SQLiteDatabase) {}
  async listByMessage(messageId: MessageId): Promise<DbAttachment[]> {
    const rows = await this.db.getAllAsync<AttachmentRow>(
      `
      SELECT id, message_id, filename, mime_type, data, uri, size_bytes
      FROM attachments
      WHERE message_id = ?
      ORDER BY id ASC
      `,
      [messageId],
    );
    return rows.map(rowToAttachment);
  }
  async add(input: AttachmentAddInput): Promise<DbAttachment> {
    const uri = input.uri ?? null;
    const sizeBytes = input.sizeBytes ?? input.data.byteLength;
    const result = await this.db.runAsync(
      `
      INSERT INTO attachments (message_id, filename, mime_type, data, uri, size_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        input.messageId,
        input.filename,
        input.mimeType,
        input.data,
        uri,
        sizeBytes,
      ],
    );
    return {
      ...input,
      id: asAttachmentId(result.lastInsertRowId),
      uri,
      sizeBytes,
    };
  }
  async delete(id: AttachmentId): Promise<void> {
    await this.db.runAsync("DELETE FROM attachments WHERE id = ?", [id]);
  }
}
