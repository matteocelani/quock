// Human-readable byte formatter for the chat history rows and the clear-all confirm dialog. Approximate, not strict — "47 KB" + "1.2 MB" + "0.85 GB" idiom that matches what people scan in iOS Storage settings. Uses 1024-base because storage size in SQLite is measured in bytes and `LENGTH(blob)` returns a count of bytes.

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;
const BYTES_PER_GB = BYTES_PER_MB * 1024;

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${Math.round(bytes / BYTES_PER_KB)} KB`;
  if (bytes < BYTES_PER_GB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}
