import type { ChatSummary } from "@/lib/db/types";
import { asChatId } from "@/lib/types/ids";
import {
  formatRelativeTimestamp,
  groupChats,
} from "@/modules/chat/lib/chatTimestamp";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function summary(id: string, updatedAt: number): ChatSummary {
  // Only `updatedAt` drives bucketing; the rest of the row is irrelevant here.
  return { id: asChatId(id), updatedAt } as unknown as ChatSummary;
}

describe("formatRelativeTimestamp", () => {
  // Fixed local noon so the start-of-day math is unambiguous regardless of when the suite runs.
  const now = new Date(2026, 5, 18, 12, 0, 0);
  const at = (ms: number) => formatRelativeTimestamp(now.getTime() - ms, now);

  it("shows 'now' under a minute", () => {
    expect(at(30 * 1000)).toBe("now");
  });

  it("shows minutes under an hour", () => {
    expect(at(5 * 60 * 1000)).toBe("5m");
  });

  it("shows hours under a day", () => {
    expect(at(3 * 60 * 60 * 1000)).toBe("3h");
  });

  it("shows 'Yesterday' one calendar day back", () => {
    expect(formatRelativeTimestamp(new Date(2026, 5, 17, 12, 0, 0).getTime(), now)).toBe(
      "Yesterday",
    );
  });

  it("shows day count within the past week", () => {
    expect(formatRelativeTimestamp(new Date(2026, 5, 15, 12, 0, 0).getTime(), now)).toBe(
      "3d",
    );
  });

  it("falls back to an absolute month-day past the week cutoff", () => {
    expect(formatRelativeTimestamp(new Date(2026, 5, 8, 12, 0, 0).getTime(), now)).toBe(
      "Jun 8",
    );
  });
});

describe("groupChats", () => {
  it("returns no buckets for an empty list", () => {
    expect(groupChats([])).toEqual([]);
  });

  it("groups by recency and emits buckets in canonical order", () => {
    const nowMs = Date.now();
    const older = summary("old", nowMs - 30 * MS_PER_DAY);
    const today = summary("new", nowMs);

    // Pass Older first to prove output ordering follows BUCKET_ORDER, not insertion order.
    const buckets = groupChats([older, today]);

    expect(buckets.map((b) => b.label)).toEqual(["Today", "Older"]);
    expect(buckets[0].rows).toEqual([today]);
    expect(buckets[1].rows).toEqual([older]);
  });
});
