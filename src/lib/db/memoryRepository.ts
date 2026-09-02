// Memory repository: durable facts the agent saves, scoped per account like chats. The newest-first ordering feeds
// prompt injection, so last_accessed_at bumps are the "hot facts stay hot" mechanism.

import type { SQLiteDatabase } from "expo-sqlite";
import { asMemoryId, type MemoryId } from "@/lib/types/ids";
import type { DbMemory } from "@/lib/db/types";

interface MemoryRow {
  id: number;
  user_id: string;
  content: string;
  created_at: number;
  updated_at: number;
  last_accessed_at: number;
  source: string | null;
}

function rowToMemory(row: MemoryRow): DbMemory {
  return {
    id: asMemoryId(row.id),
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
    source: row.source,
  };
}

export class MemoryRepository {
  // Same live-getter pattern as ChatRepository: the signed-in account id scopes every query, read per-call so a
  // sign-in/out needs no rebuild. A memory belongs to the account, not the device.
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly getUserId: () => string,
  ) {}

  async save(content: string, source?: string): Promise<DbMemory> {
    const userId = this.getUserId();
    const now = Date.now();
    const result = await this.db.runAsync(
      "INSERT INTO memories (user_id, content, created_at, updated_at, last_accessed_at, source) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, content, now, now, now, source ?? null],
    );
    return {
      id: asMemoryId(result.lastInsertRowId),
      userId,
      content,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      source: source ?? null,
    };
  }

  // Most recently touched first; the caller caps the list (injection budget lives with the caller).
  async listRecent(limit: number): Promise<DbMemory[]> {
    const userId = this.getUserId();
    const rows = await this.db.getAllAsync<MemoryRow>(
      "SELECT id, user_id, content, created_at, updated_at, last_accessed_at, source FROM memories WHERE user_id = ? ORDER BY last_accessed_at DESC, id DESC LIMIT ?",
      [userId, limit],
    );
    return rows.map(rowToMemory);
  }

  // Marks a memory as used now, keeping injected facts hot in the ordering. Scoped like every other write: a foreign
  // id must never be bumpable, so the account predicate matches forget().
  async touch(id: MemoryId): Promise<void> {
    await this.db.runAsync(
      "UPDATE memories SET last_accessed_at = ? WHERE id = ? AND user_id = ?",
      [Date.now(), id, this.getUserId()],
    );
  }

  // Scoped delete: returns 0 for a foreign id, so the tool can say "not found" without leaking another account's rows.
  async forget(id: MemoryId): Promise<number> {
    const result = await this.db.runAsync(
      "DELETE FROM memories WHERE id = ? AND user_id = ?",
      [id, this.getUserId()],
    );
    return result.changes;
  }

  async clearAll(): Promise<void> {
    await this.db.runAsync("DELETE FROM memories WHERE user_id = ?", [
      this.getUserId(),
    ]);
  }
}

// Substring match against lowercase whitespace-split tokens — deliberately simple (no embeddings in v1).
export function filterMemoriesByQuery(
  memories: readonly DbMemory[],
  query: string,
): DbMemory[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return [...memories];
  return memories.filter((m) => {
    const haystack = m.content.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });
}
