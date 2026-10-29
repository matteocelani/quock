import { FORK_TITLE_PREFIX, forkTitle } from "@/modules/chat/lib/forkTitle";

describe("forkTitle", () => {
  it("prefixes the source title", () => {
    expect(forkTitle("Trip to Lisbon")).toBe(
      `${FORK_TITLE_PREFIX}Trip to Lisbon`,
    );
  });

  it("does not stack the prefix when forking a fork", () => {
    expect(forkTitle(`${FORK_TITLE_PREFIX}Trip to Lisbon`)).toBe(
      `${FORK_TITLE_PREFIX}Trip to Lisbon`,
    );
  });

  it("still reads as a fork when the source has no title", () => {
    expect(forkTitle("")).toBe("Fork");
    expect(forkTitle("   ")).toBe("Fork");
  });

  it("drops the source title's outer whitespace", () => {
    expect(forkTitle("  Trip  ")).toBe(`${FORK_TITLE_PREFIX}Trip`);
  });
});
