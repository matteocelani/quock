// An overlay anchor is the unit's measureInWindow reading minus its ancestor's: that cancels the surface's viewport
// offset and any translation the two share. Pure so the sign is testable.

import type { AnchorRect } from "@/lib/types/geometry";

export interface Measured {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
