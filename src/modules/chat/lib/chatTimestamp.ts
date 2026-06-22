// Hand-rolled relative timestamp + bucketing helpers for the chat history sheet. Hermes on iOS ships a stripped Intl (no `RelativeTimeFormat` / `DateTimeFormat`), so we cannot lean on `new Intl.RelativeTimeFormat(...).format(...)`. Cadence mirrors iOS Messages: minutes/hours today → "Yesterday" yesterday → weekday this week → month-day older.

import type { ChatSummary } from "@/lib/db/types";

export type BucketLabel = "Today" | "Yesterday" | "This week" | "Older";

export interface Bucket {
  label: BucketLabel;
  rows: ChatSummary[];
}

const BUCKET_ORDER: readonly BucketLabel[] = [
  "Today",
  "Yesterday",
  "This week",
  "Older",
] as const;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const DAYS_IN_WEEK = 7;
// Beyond this many days the absolute month-day form is more readable than "Xd ago".
const RELATIVE_DAY_CUTOFF = 6;
const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function startOfLocalDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

export function formatRelativeTimestamp(
  updatedAt: number,
  now: Date,
): string {
  const diffMs = now.getTime() - updatedAt;
  if (diffMs < MS_PER_MINUTE) return "now";
  if (diffMs < MS_PER_HOUR) {
    const minutes = Math.floor(diffMs / MS_PER_MINUTE);
    return `${minutes}m`;
  }
  if (diffMs < MS_PER_DAY) {
    const hours = Math.floor(diffMs / MS_PER_HOUR);
    return `${hours}h`;
  }
  const startOfToday = startOfLocalDay(now);
  const days = Math.floor(
    (startOfToday - startOfLocalDay(new Date(updatedAt))) / MS_PER_DAY,
  );
  if (days <= 1) return "Yesterday";
  if (days <= RELATIVE_DAY_CUTOFF) return `${days}d`;
  const date = new Date(updatedAt);
  return `${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getDate()}`;
}
// Compare against the start of the local day so "yesterday at 23:55" still buckets as Yesterday.
function bucketFor(updatedAt: number, now: Date): BucketLabel {
  const startOfToday = startOfLocalDay(now);
  const startOfYesterday = startOfToday - MS_PER_DAY;
  const startOfWeek = startOfToday - DAYS_IN_WEEK * MS_PER_DAY;
  if (updatedAt >= startOfToday) return "Today";
  if (updatedAt >= startOfYesterday) return "Yesterday";
  if (updatedAt >= startOfWeek) return "This week";
  return "Older";
}

export function groupChats(chats: ChatSummary[]): Bucket[] {
  const now = new Date();
  const map = new Map<BucketLabel, ChatSummary[]>();
  for (const chat of chats) {
    const label = bucketFor(chat.updatedAt, now);
    const existing = map.get(label);
    if (existing) existing.push(chat);
    else map.set(label, [chat]);
  }
  // Preserve canonical ordering rather than insertion order.
  return BUCKET_ORDER.filter((label) => map.has(label)).map((label) => ({
    label,
    rows: map.get(label) ?? [],
  }));
}
