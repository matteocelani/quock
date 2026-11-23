import type { KeyboardEvent } from "react";

// Arrow keys, Home and End move between tabs: the WAI-ARIA tabs pattern, shared by both tab rows.
export function handleTabKeys(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  count: number,
  select: (next: number) => void,
): void {
  const moves: Record<string, number> = {
    ArrowRight: (index + 1) % count,
    ArrowLeft: (index - 1 + count) % count,
    Home: 0,
    End: count - 1,
  };
  const next = moves[event.key];
  if (next === undefined) return;
  event.preventDefault();
  select(next);
  const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  tabs?.[next]?.focus();
}
