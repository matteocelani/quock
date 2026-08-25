import { anchorRelativeTo } from "@/components/ui/markdown/anchorRect";

// A unit two thirds down a scrolled reply, as measureInWindow reports it.
const unit = { x: 7, y: 241, width: 456, height: 422 };

describe("anchorRelativeTo", () => {
  // Android reports the ancestor ABOVE the window origin by the status bar, so the anchor has to come back down.
  it("brings the anchor down when the ancestor measures above the origin", () => {
    expect(anchorRelativeTo(unit, { x: 0, y: -43 })).toEqual({
      top: 284,
      bottom: 706,
      left: 7,
      width: 456,
    });
  });

  // iOS: the ancestor is the window origin, so the reading passes through untouched.
  it("passes the reading through when the ancestor is at the origin", () => {
    expect(anchorRelativeTo(unit, { x: 0, y: 0 })).toEqual({
      top: 241,
      bottom: 663,
      left: 7,
      width: 456,
    });
  });

  // An ancestor inset by a real header measures BELOW the origin; the anchor then has to move up, not down.
  it("lifts the anchor when the ancestor sits below the origin", () => {
    expect(anchorRelativeTo(unit, { x: 0, y: 64 }).top).toBe(177);
  });

  // The drawer translates the reply and this overlay's ancestor alike, so cancelling it is what keeps them aligned.
  it("cancels a horizontal shift both readings carry", () => {
    const shifted = { ...unit, x: unit.x + 471 };
    expect(anchorRelativeTo(shifted, { x: 471, y: 0 }).left).toBe(unit.x);
  });

  it("never scales the width, whatever the origin", () => {
    expect(anchorRelativeTo(unit, { x: -20, y: -43 }).width).toBe(unit.width);
  });

  it("keeps a unit scrolled above the fold above the fold", () => {
    const offscreen = { x: 7, y: -80, width: 456, height: 60 };
    expect(anchorRelativeTo(offscreen, { x: 0, y: -43 }).top).toBe(-37);
  });
});
