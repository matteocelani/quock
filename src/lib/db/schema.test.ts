import {
  addColumnTargets,
  CURRENT_VERSION,
  MIGRATIONS,
  planMigration,
} from "@/lib/db/schema";

const NO_COLUMNS = (): boolean => false;

describe("addColumnTargets", () => {
  it("finds every column a multi-statement migration adds", () => {
    expect(
      addColumnTargets(`
        ALTER TABLE chats ADD COLUMN think_enabled INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE chats ADD COLUMN web_search_enabled INTEGER NOT NULL DEFAULT 0;
      `),
    ).toEqual([
      { table: "chats", column: "think_enabled" },
      { table: "chats", column: "web_search_enabled" },
    ]);
  });

  it("finds nothing in a body that only creates tables and indexes", () => {
    expect(
      addColumnTargets(`
        CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY);
        CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);
      `),
    ).toEqual([]);
  });
});

describe("planMigration", () => {
  it("keeps a body with no ADD COLUMN whole, so multi-line DDL is never split", () => {
    const up = `
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT ''
      );
    `;
    expect(planMigration(up, NO_COLUMNS)).toEqual({
      run: [up],
      skipped: [],
      unreadable: [],
    });
  });

  it("runs every statement when the columns are absent", () => {
    const { run, skipped } = planMigration(
      "ALTER TABLE attachments ADD COLUMN text_content TEXT;",
      NO_COLUMNS,
    );
    expect(run).toEqual([
      "ALTER TABLE attachments ADD COLUMN text_content TEXT",
    ]);
    expect(skipped).toEqual([]);
  });

  // The failure this guards: a migration renumbered after it had already run stamped an older user_version, so the
  // column exists while the id looks pending. Re-adding it aborts the transaction and the database never opens again.
  it("drops an ADD COLUMN whose column is already there and keeps the rest", () => {
    const { run, skipped } = planMigration(
      `
        ALTER TABLE attachments ADD COLUMN text_content TEXT;
        CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
      `,
      (table, column) => table === "attachments" && column === "text_content",
    );
    expect(run).toEqual([
      "CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id)",
    ]);
    expect(skipped).toEqual([{ table: "attachments", column: "text_content" }]);
  });

  it("skips only the column that exists when a migration adds two", () => {
    const { run, skipped } = planMigration(
      `
        ALTER TABLE messages ADD COLUMN sent_with_think INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE messages ADD COLUMN sent_with_web_search INTEGER NOT NULL DEFAULT 0;
      `,
      (_table, column) => column === "sent_with_think",
    );
    expect(run).toEqual([
      "ALTER TABLE messages ADD COLUMN sent_with_web_search INTEGER NOT NULL DEFAULT 0",
    ]);
    expect(skipped).toEqual([{ table: "messages", column: "sent_with_think" }]);
  });

  it.each([
    "ALTER TABLE attachments ADD COLUMN text_content TEXT;",
    "ALTER TABLE attachments ADD text_content TEXT;",
    "alter table attachments add column text_content text;",
    "ALTER\n\tTABLE   attachments\n  ADD COLUMN\n  text_content TEXT;",
  ])("guards the bare form %#", (statement) => {
    const { run, skipped } = planMigration(
      statement,
      (_table, column) => column === "text_content",
    );
    expect(run).toEqual([]);
    expect(skipped).toEqual([{ table: "attachments", column: "text_content" }]);
  });

  // Reading `"te""st"` as `te` would report a confident wrong column: it would look guarded while the ALTER still ran
  // and still crashed. Not understanding a quoted name at all, and saying so, is the safer failure.
  it.each([
    'ALTER TABLE attachments ADD COLUMN "te""st" TEXT;',
    'ALTER TABLE attachments ADD COLUMN "text_content" TEXT;',
    "ALTER TABLE attachments ADD COLUMN [text_content] TEXT;",
  ])("reports rather than half-reads a quoted name %#", (statement) => {
    const { skipped, unreadable } = planMigration(statement, () => true);
    expect(skipped).toEqual([]);
    expect(unreadable).toEqual([statement.replace(/;$/, "")]);
  });

  // Splitting on a semicolon inside a literal or a comment would hand SQLite two broken fragments and abort even a
  // brand-new install, which is a worse failure than the one this guard exists to prevent.
  it.each([
    "ALTER TABLE messages ADD COLUMN note TEXT NOT NULL DEFAULT 'a;b'",
    "ALTER TABLE messages ADD COLUMN note TEXT NOT NULL DEFAULT 'x'",
  ])("keeps %# whole across a semicolon it owns", (statement) => {
    const { run, skipped } = planMigration(`${statement};`, NO_COLUMNS);
    expect(run).toEqual([statement]);
    expect(skipped).toEqual([]);
  });

  it("strips comments, so a commented migration is still guarded", () => {
    const { run, skipped, unreadable } = planMigration(
      `
        -- late rename; keep the old column around
        ALTER TABLE messages ADD COLUMN note TEXT;
        /* two ; inside a block comment */
        ALTER TABLE messages ADD COLUMN tag TEXT;
      `,
      (_table, column) => column === "note",
    );
    expect(run).toEqual(["ALTER TABLE messages ADD COLUMN tag TEXT"]);
    expect(skipped).toEqual([{ table: "messages", column: "note" }]);
    expect(unreadable).toEqual([]);
  });

  it("does not warn about an ALTER that is not an add-column", () => {
    const { unreadable } = planMigration(
      "ALTER TABLE messages RENAME COLUMN foo TO bar;",
      () => true,
    );
    expect(unreadable).toEqual([]);
  });
});

describe("MIGRATIONS", () => {
  // An id is spent the moment an install runs it, so two migrations sharing one id means whichever the device saw
  // first wins and the other never runs. Gaps are fine — a spent id is deliberately never reused.
  it("declares strictly ascending, unique ids", () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never adds the same column twice across migrations", () => {
    const seen = new Set<string>();
    for (const migration of MIGRATIONS) {
      for (const target of addColumnTargets(migration.up)) {
        const key = `${target.table}.${target.column}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("reports the last id as the current version", () => {
    expect(CURRENT_VERSION).toBe(MIGRATIONS[MIGRATIONS.length - 1].id);
  });

  // The guard only understands bare identifiers, so this turns a quoted one into a CI failure here rather than a
  // warning nobody reads and, on a device that already has the column, an app that will not open.
  it("writes every add-column in a form the guard can read", () => {
    for (const migration of MIGRATIONS) {
      const { unreadable } = planMigration(migration.up, () => false);
      expect(unreadable).toEqual([]);
    }
  });
});
