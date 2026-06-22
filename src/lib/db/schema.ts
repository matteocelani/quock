// SQLite schema and migrations for the local persistence layer.

import type { SQLiteDatabase } from "expo-sqlite";
import { INITIAL_USER_VERSION } from "@/lib/constants/magic-numbers";

export interface Migration {
  id: number;
  up: string;
}
// FKs cascade to keep chat deletion atomic; synced_at is reserved for a future server sync.
const INITIAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    thinking TEXT,
    model TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    thinking_time_start INTEGER,
    thinking_time_end INTEGER,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    data BLOB NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_messages_chat
    ON messages(chat_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_chats_updated
    ON chats(updated_at DESC);
`;
// Adds `status` + `error_code` so the UI reads lifecycle state from typed columns instead of parsing it out of `content`.
const ADD_MESSAGE_STATUS = `
  ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'complete';
  ALTER TABLE messages ADD COLUMN error_code TEXT;
`;
// `uri` survives DB round-trips for thumbnails; `size_bytes` lets the UI validate before send.
const ADD_ATTACHMENT_PREVIEW = `
  ALTER TABLE attachments ADD COLUMN uri TEXT;
  ALTER TABLE attachments ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;
`;
// Per-chat model NAME. NULL means "not started yet": an empty chat shows the live global default until its first message locks the model in (see useSendMessage), after which it keeps its own model across restarts.
const ADD_CHAT_MODEL = `
  ALTER TABLE chats ADD COLUMN model TEXT;
`;
// Flags an assistant turn whose web-search tool failed (auth/network) so the bubble can show a non-fatal "Web search unavailable" note even though the model still answered. Stored as 0/1; survives restarts so the note persists when scrolling back.
const ADD_MESSAGE_WEB_SEARCH_FAILED = `
  ALTER TABLE messages ADD COLUMN web_search_failed INTEGER NOT NULL DEFAULT 0;
`;
// Per-chat composer mode toggles (think + web search), so each chat remembers its own sticky settings across switches and restarts — like the pinned model. Stored as 0/1; both default off.
const ADD_CHAT_COMPOSER_MODES = `
  ALTER TABLE chats ADD COLUMN think_enabled INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE chats ADD COLUMN web_search_enabled INTEGER NOT NULL DEFAULT 0;
`;
// Records which modes were active when a USER turn was sent, so its bubble can show small read-only indicators ("sent with thinking forced / web search on"). Stored as 0/1; ~1 byte each, both default off.
const ADD_MESSAGE_SENT_MODES = `
  ALTER TABLE messages ADD COLUMN sent_with_think INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE messages ADD COLUMN sent_with_web_search INTEGER NOT NULL DEFAULT 0;
`;

export const MIGRATIONS: readonly Migration[] = [
  { id: 1, up: INITIAL_SCHEMA },
  { id: 2, up: ADD_MESSAGE_STATUS },
  { id: 3, up: ADD_ATTACHMENT_PREVIEW },
  { id: 4, up: ADD_CHAT_MODEL },
  { id: 5, up: ADD_MESSAGE_WEB_SEARCH_FAILED },
  { id: 6, up: ADD_CHAT_COMPOSER_MODES },
  { id: 7, up: ADD_MESSAGE_SENT_MODES },
];
export const CURRENT_VERSION: number =
  MIGRATIONS.length > 0
    ? MIGRATIONS[MIGRATIONS.length - 1].id
    : INITIAL_USER_VERSION;
interface UserVersionRow {
  user_version: number;
}
// Idempotent: running migrate() twice in a row is a no-op the second time.
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<UserVersionRow>("PRAGMA user_version");
  const current = row?.user_version ?? INITIAL_USER_VERSION;
  const pending = MIGRATIONS.filter((m) => m.id > current);
  if (pending.length === 0) {
    return;
  }
  // Enable foreign keys before applying schema changes so CASCADE works.
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.withTransactionAsync(async () => {
    for (const migration of pending) {
      await db.execAsync(migration.up);
    }
    // Stamp the version inside the transaction so schema + version commit atomically; a separate write could crash between them, re-running the ALTER on next launch and bricking on a duplicate column.
    // PRAGMA can't be parameterised; the value is the trusted CURRENT_VERSION constant.
    await db.execAsync(`PRAGMA user_version = ${CURRENT_VERSION};`);
  });
}
