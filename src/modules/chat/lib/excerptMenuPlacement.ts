// Where the excerpt menu's bar sits: above the pressed block when it fits, else below, always inside the band the
// header and composer leave. Pure so the clamps are testable — a wrong sign misplaces it silently, on some sizes only.

export interface ExcerptMenuPlacement {
  anchorTop: number;
  anchorBottom: number;
  /** Safe-area top + floating header. */
  topInset: number;
  /** Composer, plus the keyboard when it is open. */
  bottomInset: number;
  screenHeight: number;
  barHeight: number;
  gap: number;
}

export function excerptMenuTop({
  anchorTop,
  anchorBottom,
  topInset,
  bottomInset,
  screenHeight,
  barHeight,
  gap,
}: ExcerptMenuPlacement): number {
  const lowest = Math.max(topInset, screenHeight - bottomInset - barHeight);
  const above = anchorTop - gap - barHeight;
  if (above >= topInset) return Math.min(above, lowest);
  return Math.min(Math.max(topInset, anchorBottom + gap), lowest);
}
