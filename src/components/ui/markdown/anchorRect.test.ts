import { anchorRelativeTo } from "@/components/ui/markdown/anchorRect";

// Logged off the device the bug was found on: 1200x2670 at 408dpi, so 470.6dp wide with a 43.1dp status bar.
const unit = { x: 7, y: 241, width: 456, height: 422 };

describe("anchorRelativeTo", () => {
  it("brings the anchor down when the ancestor measures above the origin", () => {
    expect(anchorRelativeTo(unit, { x: 0, y: -43 })).toEqual({
      top: 284,
      bottom: 706,
      left: 7,
      width: 456,
    });
  });

  it("passes the reading through when the ancestor is at the origin", () => {
    expect(anchorRelativeTo(unit, { x: 0, y: 0 })).toEqual({
      top: 241,
      bottom: 663,
      left: 7,
      width: 456,
    });
  });

  it("lifts the anchor when the ancestor sits below the origin", () => {
    expect(anchorRelativeTo(unit, { x: 0, y: 64 }).top).toBe(177);
  });

  // The drawer translates the reply and this overlay's ancestor alike, so cancelling it is what keeps them aligned.
  it("cancels a horizontal shift both readings carry", () => {
    const shifted = { ...unit, x: unit.x + 471 };
    expect(anchorRelativeTo(shifted, { x: 471, y: 0 }).left).toBe(unit.x);
  });
});
