// Pure so the sign is testable: subtracting the wrong way doubles the error instead of cancelling it, and the symptom
// reads as a design slip rather than arithmetic.

import type { AnchorRect } from "@/lib/types/geometry";

/** A measureInWindow reading: the unit's box, and the box of the ancestor the overlay draws inside. */
export interface Measured {
  x: number;
  y: number;
  width: number;
  height: number;
}

// measureInWindow folds the surface's viewport offset (minus the status bar on Android, zero on iOS) and every ancestor
// transform into both readings, so subtracting the ancestor's cancels all of it. Why not measureLayout: Platform notes.
export function anchorRelativeTo(
  unit: Measured,
  origin: Pick<Measured, "x" | "y">,
): AnchorRect {
  return {
    top: unit.y - origin.y,
    bottom: unit.y + unit.height - origin.y,
    left: unit.x - origin.x,
    width: unit.width,
  };
}
