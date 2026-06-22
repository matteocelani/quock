// Singleton SQLite connection wrapping expo-sqlite's async API.

import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { migrate } from "@/lib/db/schema";

const DB_NAME = "ollama.db";
const MEMORY_DB_NAME = ":memory:";
let cachedDb: SQLiteDatabase | null = null;
let openPromise: Promise<SQLiteDatabase> | null = null;
async function configure(db: SQLiteDatabase): Promise<void> {
  // WAL gives better concurrency; foreign_keys must be enabled per-connection.
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
}
// Returns the cached shared connection, opening + migrating it on first call.
export async function openDb(): Promise<SQLiteDatabase> {
  if (cachedDb) {
    return cachedDb;
  }
  if (openPromise) {
    return openPromise;
  }
  openPromise = (async () => {
    const db = await openDatabaseAsync(DB_NAME);
    await configure(db);
    await migrate(db);
    cachedDb = db;
    return db;
  })();
  try {
    return await openPromise;
  } finally {
    openPromise = null;
  }
}
// Opens a fresh in-memory database for tests. `useNewConnection` bypasses expo-sqlite's name-based cache so individual tests cannot see each other's data.
export async function __resetForTest(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(MEMORY_DB_NAME, {
    useNewConnection: true,
  });
  await configure(db);
  await migrate(db);
  return db;
}
