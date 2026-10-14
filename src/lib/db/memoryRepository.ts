// Memory repository: the few durable facts the model keeps about the signed-in account, in the `memory_facts` table.

import type { SQLiteDatabase } from "expo-sqlite";
import { asFactId, type FactId } from "@/lib/types/ids";
import type { DbMemoryFact } from "@/lib/db/types";

interface FactRow {
  id: number;
  content: string;
  created_at: number;
}

function rowToFact(row: FactRow): DbMemoryFact {
  return {
    id: asFactId(row.id),
    content: row.content,
    createdAt: row.created_at,
  };
}

export class MemoryRepository {
  // Scoped to getUserId() exactly like ChatRepository, read live per call so sign-in/out needs no rebuild.
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly getUserId: () => string,
  ) {}

  // Oldest first: AUTOINCREMENT ids follow insertion order.
  async list(): Promise<DbMemoryFact[]> {
    const rows = await this.db.getAllAsync<FactRow>(
      "SELECT id, content, created_at FROM memory_facts WHERE user_id = ? ORDER BY id ASC",
      [this.getUserId()],
    );
    return rows.map(rowToFact);
  }

  // Two plain statements, not a transaction: withTransactionAsync is not exclusive, so two chats saving at once would
  // collide. At worst one extra fact lives until the next save trims it; content arrives validated by the chat gate.
  async add(content: string, maxFacts: number): Promise<DbMemoryFact> {
    const userId = this.getUserId();
    const createdAt = Date.now();
    const inserted = await this.db.runAsync(
      "INSERT INTO memory_facts (user_id, content, created_at) VALUES (?, ?, ?)",
      [userId, content, createdAt],
    );
    await this.db.runAsync(
      "DELETE FROM memory_facts WHERE user_id = ? AND id NOT IN (SELECT id FROM memory_facts WHERE user_id = ? ORDER BY id DESC LIMIT ?)",
      [userId, userId, maxFacts],
    );
    return { id: asFactId(inserted.lastInsertRowId), content, createdAt };
  }

  // False when this account has no fact with that id, so the caller tells the model instead of claiming success.
  async remove(id: FactId): Promise<boolean> {
    const outcome = await this.db.runAsync(
      "DELETE FROM memory_facts WHERE id = ? AND user_id = ?",
      [id, this.getUserId()],
    );
    return outcome.changes > 0;
  }

  // Every account's facts on this device, for the consent-revoke reset. Unscoped on purpose, like ChatRepository.clearAllDevice.
  async clearAllDevice(): Promise<void> {
    await this.db.execAsync("DELETE FROM memory_facts");
  }
}
