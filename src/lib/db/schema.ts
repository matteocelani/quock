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
// Scopes each chat to the Ollama account (id from /api/me) that created it, so switching accounts on one device never surfaces another account's local chats. Pre-existing rows get NULL — orphaned and hidden from every account.
const ADD_CHAT_USER = `
  ALTER TABLE chats ADD COLUMN user_id TEXT;
  CREATE INDEX IF NOT EXISTS idx_chats_user_updated ON chats(user_id, updated_at DESC);
`;
// A PDF's extracted text (JSON, so the per-page structure survives), stored once so every later turn can replay it without a native pass. NULL for anything re-decodable from `data`. The index serves the per-chat attachment read.
// Numbered 10 because a build carrying a DIFFERENT migration 9 stamped user_version = 9 on a device: an id is spent the moment any install runs it, even if the migration is deleted before merge.
const ADD_ATTACHMENT_TEXT = `
  ALTER TABLE attachments ADD COLUMN text_content TEXT;
  CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
`;

// Marks a row the app derived from another attachment (a PDF page rendered for a vision model). The UI hides these —
// you attached one document, you should see one document — while the wire still needs them on every replayed turn.
const ADD_ATTACHMENT_DERIVED = `
  ALTER TABLE attachments ADD COLUMN derived_from INTEGER;
`;

// Agent-mode memory: durable facts the model saves about/for the account, scoped by user_id so accounts never leak.
// last_accessed_at feeds the newest-first injection; source distinguishes model-written rows from future user edits.
const ADD_MEMORY_TABLE = `
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    source TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_memories_user_accessed
    ON memories(user_id, last_accessed_at DESC);
`;

// Per-chat agent-mode toggle (memory tools + local device tools + injected system context). Mirrors think/web_search:
// sticky, defaults off, gated on the model's tool capability.
const ADD_CHAT_AGENT_MODE = `
  ALTER TABLE chats ADD COLUMN agent_enabled INTEGER NOT NULL DEFAULT 0;
`;

// Marks a USER turn that ran under agent mode, so its bubble shows the same kind of read-only "sent with agent" chip
// as the other two sent_with_* indicators.
const ADD_MESSAGE_SENT_WITH_AGENT = `
  ALTER TABLE messages ADD COLUMN sent_with_agent INTEGER NOT NULL DEFAULT 0;
`;

export const MIGRATIONS: readonly Migration[] = [
  { id: 1, up: INITIAL_SCHEMA },
  { id: 2, up: ADD_MESSAGE_STATUS },
  { id: 3, up: ADD_ATTACHMENT_PREVIEW },
  { id: 4, up: ADD_CHAT_MODEL },
  { id: 5, up: ADD_MESSAGE_WEB_SEARCH_FAILED },
  { id: 6, up: ADD_CHAT_COMPOSER_MODES },
  { id: 7, up: ADD_MESSAGE_SENT_MODES },
  { id: 8, up: ADD_CHAT_USER },
  { id: 10, up: ADD_ATTACHMENT_TEXT },
  { id: 11, up: ADD_ATTACHMENT_DERIVED },
  { id: 12, up: ADD_MEMORY_TABLE },
  { id: 13, up: ADD_CHAT_AGENT_MODE },
  { id: 14, up: ADD_MESSAGE_SENT_WITH_AGENT },
];
export const CURRENT_VERSION: number =
  MIGRATIONS.length > 0
    ? MIGRATIONS[MIGRATIONS.length - 1].id
    : INITIAL_USER_VERSION;

export interface AddColumnTarget {
  table: string;
  column: string;
}
// Bare snake_case only, which is every identifier this schema uses. A quoted one is deliberately NOT understood: half-
// reading `"te""st"` as `te` would look guarded while re-adding the column, so it is reported instead (see below).
const IDENTIFIER = String.raw`[A-Za-z_][A-Za-z0-9_]*`;
// `COLUMN` is optional because SQLite accepts `ADD <name>` too. The lookahead stops backtracking from capturing the
// keyword itself as the column name when what follows it is a form this pattern cannot read.
const ADD_COLUMN_PATTERN = new RegExp(
  String.raw`^ALTER\s+TABLE\s+(${IDENTIFIER})\s+ADD\s+(?:COLUMN\s+)?(?!COLUMN\b)(${IDENTIFIER})\b`,
  "i",
);
// Anything shaped like an add-column the strict pattern could not read. Anchored so a stray "add" in prose cannot
// trigger it, and comments are gone by the time it runs.
const LOOSE_ADD_PATTERN = new RegExp(
  String.raw`^ALTER\s+TABLE\s+\S+\s+ADD\b`,
  "i",
);

// One pass that drops SQL comments and splits on the semicolons that actually end a statement: a `;` inside a literal,
// a quoted identifier or a comment does not, and cutting there hands SQLite two broken fragments on every device.
function splitStatements(up: string): string[] {
  const parts: string[] = [];
  let current = "";
  let closing: string | null = null;
  for (let i = 0; i < up.length; i += 1) {
    const char = up[i];
    if (closing !== null) {
      current += char;
      if (char === closing) closing = null;
      continue;
    }
    if (char === "-" && up[i + 1] === "-") {
      const end = up.indexOf("\n", i);
      i = end === -1 ? up.length : end;
      continue;
    }
    if (char === "/" && up[i + 1] === "*") {
      const end = up.indexOf("*/", i + 2);
      i = end === -1 ? up.length : end + 1;
      continue;
    }
    if (char === ";") {
      parts.push(current);
      current = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") closing = char;
    else if (char === "[") closing = "]";
    current += char;
  }
  parts.push(current);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

function parseAddColumn(statement: string): AddColumnTarget | null {
  const match = ADD_COLUMN_PATTERN.exec(statement);
  return match ? { table: match[1], column: match[2] } : null;
}

// The columns a migration wants to add, so the runner knows which tables to inspect before touching anything.
export function addColumnTargets(up: string): AddColumnTarget[] {
  const targets: AddColumnTarget[] = [];
  for (const statement of splitStatements(up)) {
    const target = parseAddColumn(statement);
    if (target) targets.push(target);
  }
  return targets;
}

// An id is spent the moment any install runs it, so renumbering a migration that already ran on a device makes it run
// AGAIN — and a repeated ADD COLUMN aborts the whole transaction, leaving a database that never opens.
export function planMigration(
  up: string,
  hasColumn: (table: string, column: string) => boolean,
): { run: string[]; skipped: AddColumnTarget[]; unreadable: string[] } {
  const statements = splitStatements(up);
  const unreadable = statements.filter(
    (s) => parseAddColumn(s) === null && LOOSE_ADD_PATTERN.test(s),
  );
  // Nothing to guard: keep the body as one statement so multi-line DDL is never split on a semicolon it owns.
  if (!statements.some((s) => parseAddColumn(s) !== null)) {
    return { run: [up], skipped: [], unreadable };
  }
  const run: string[] = [];
  const skipped: AddColumnTarget[] = [];
  for (const statement of statements) {
    const target = parseAddColumn(statement);
    if (target && hasColumn(target.table, target.column)) {
      skipped.push(target);
      continue;
    }
    run.push(statement);
  }
  return { run, skipped, unreadable };
}

interface UserVersionRow {
  user_version: number;
}
interface TableInfoRow {
  name: string;
}
// Columns as they stand BEFORE this run, on purpose: a column added by an earlier pending migration is absent from the
// snapshot, so two migrations adding the same column still fail loudly instead of being quietly tolerated.
async function snapshotColumns(
  db: SQLiteDatabase,
  tables: readonly string[],
): Promise<Map<string, Set<string>>> {
  const byTable = new Map<string, Set<string>>();
  for (const table of tables) {
    // PRAGMA can't be parameterised; the name comes from our own SQL via a pattern that admits identifiers only.
    const rows = await db.getAllAsync<TableInfoRow>(
      `PRAGMA table_info(${table});`,
    );
    byTable.set(table, new Set(rows.map((r) => r.name)));
  }
  return byTable;
}
// Idempotent: running migrate() twice in a row is a no-op the second time.
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<UserVersionRow>("PRAGMA user_version");
  const current = row?.user_version ?? INITIAL_USER_VERSION;
  const pending = MIGRATIONS.filter((m) => m.id > current);
  if (pending.length === 0) {
    return;
  }
  const tables = [
    ...new Set(
      pending.flatMap((m) => addColumnTargets(m.up)).map((t) => t.table),
    ),
  ];
  const columns = await snapshotColumns(db, tables);
  const hasColumn = (table: string, column: string): boolean =>
    columns.get(table)?.has(column) === true;
  // Enable foreign keys before applying schema changes so CASCADE works.
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.withTransactionAsync(async () => {
    for (const migration of pending) {
      const { run, skipped, unreadable } = planMigration(
        migration.up,
        hasColumn,
      );
      if (skipped.length > 0) {
        // Never silent: a skip is expected after a renumber, but it is also how a duplicated migration would look.
        console.warn(
          `migrate: migration ${migration.id} skipped columns already present:`,
          skipped.map((t) => `${t.table}.${t.column}`).join(", "),
        );
      }
      if (unreadable.length > 0) {
        // The guard is blind to these, so they run unprotected — say so rather than let a future author assume cover.
        console.warn(
          `migrate: migration ${migration.id} has add-column statements the guard cannot parse:`,
          unreadable.join(" | "),
        );
      }
      for (const statement of run) {
        await db.execAsync(statement);
      }
    }
    // Stamp the version inside the transaction so schema + version commit atomically; a separate write could crash between them, re-running the ALTER on next launch and bricking on a duplicate column.
    // PRAGMA can't be parameterised; the value is the trusted CURRENT_VERSION constant.
    await db.execAsync(`PRAGMA user_version = ${CURRENT_VERSION};`);
  });
}
