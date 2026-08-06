import {
  excerptMenuTop,
  type ExcerptMenuPlacement,
} from "@/modules/chat/lib/excerptMenuPlacement";

const base: ExcerptMenuPlacement = {
  anchorTop: 400,
  anchorBottom: 600,
  topInset: 119,
  bottomInset: 88,
  screenHeight: 932,
  barHeight: 44,
  gap: 8,
};

describe("excerptMenuTop", () => {
  it("sits above the block when there is room", () => {
    expect(excerptMenuTop(base)).toBe(400 - 8 - 44);
  });

  it("drops below the block when the header would clip it", () => {
    expect(excerptMenuTop({ ...base, anchorTop: 130, anchorBottom: 300 })).toBe(
      308,
    );
  });

  it("never rises into the header, even for a block scrolled off the top", () => {
    const top = excerptMenuTop({ ...base, anchorTop: -200, anchorBottom: -40 });
    expect(top).toBeGreaterThanOrEqual(base.topInset);
  });

  it("never drops into the composer for a block that ends past it", () => {
    const top = excerptMenuTop({ ...base, anchorTop: 700, anchorBottom: 900 });
    expect(top).toBeLessThanOrEqual(932 - 88 - 44);
  });

  it("stays inside the band when the keyboard squeezes it to nothing", () => {
    const top = excerptMenuTop({
      ...base,
      anchorTop: 200,
      anchorBottom: 800,
      bottomInset: 800,
    });
    expect(top).toBe(base.topInset);
  });

  it("keeps the header edge when the band inverts", () => {
    const top = excerptMenuTop({ ...base, bottomInset: 2000 });
    expect(top).toBe(base.topInset);
  });
});
