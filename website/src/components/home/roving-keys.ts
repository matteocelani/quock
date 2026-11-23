import type { KeyboardEvent } from "react";

// Arrows, Home and End move through a group with one Tab stop (WAI-ARIA tabs and radio groups).
// Both axes work, because the showcase tabs stack on phones and sit in a row on wider screens.
export function handleRovingKeys(
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
  const role = event.currentTarget.getAttribute("role");
  const group = event.currentTarget.closest('[role="tablist"], [role="radiogroup"]');
  group?.querySelectorAll<HTMLButtonElement>(`[role="${role}"]`)[target]?.focus();
}
