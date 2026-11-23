import type { KeyboardEvent } from "react";

// Arrows, Home and End move between tabs (WAI-ARIA tabs). Both axes work, because the
// showcase tabs stack vertically on phones and sit in a row on wider screens.
export function handleTabKeys(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  count: number,
  select: (next: number) => void,
): void {
  const next = (index + 1) % count;
  const previous = (index - 1 + count) % count;
  const moves: Record<string, number> = {
    ArrowRight: next,
    ArrowDown: next,
    ArrowLeft: previous,
    ArrowUp: previous,
    Home: 0,
    End: count - 1,
  };
  const target = moves[event.key];
  if (target === undefined) return;
  event.preventDefault();
  select(target);
  const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  tabs?.[target]?.focus();
}
