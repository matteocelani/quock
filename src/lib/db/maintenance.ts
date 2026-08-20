// Disk-space housekeeping. SQLite returns deleted pages to a freelist INSIDE the file, so the database never shrinks
// on its own: only VACUUM rebuilds it compactly, and it does so regardless of the auto_vacuum mode.

import type { SQLiteDatabase } from "expo-sqlite";

// Rebuilds the file without the free pages. Reserved for the flows where the user explicitly asked for space back —
// it rewrites the whole database, so it must never sit on a per-row delete path.
export async function reclaimDiskSpace(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("VACUUM;");
}
