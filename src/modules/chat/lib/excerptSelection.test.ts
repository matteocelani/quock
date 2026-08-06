import { resolveExcerpt } from "@/modules/chat/lib/excerptSelection";
import { asMessageId } from "@/lib/types/ids";

// Literal keys on purpose: `s0` / `b0i1` are the shape the renderer sends, so a change to the key scheme must fail here.
const CONTENT = "## Caveats\n\nMind the gap.\n";
const LIST = "- first item\n- second item\n";
const MESSAGES = [
  { id: asMessageId(42), content: CONTENT },
  { id: asMessageId(7), content: LIST },
];

describe("resolveExcerpt", () => {
  it("resolves the composite key to the unit's text", () => {
    expect(resolveExcerpt(MESSAGES, "42:s0")).toContain("Mind the gap.");
  });

  it("resolves a list item to that item alone", () => {
    expect(resolveExcerpt(MESSAGES, "7:b0i1")).toBe("second item");
  });

  it("returns empty when the unit is gone from a message that is still there", () => {
    expect(resolveExcerpt(MESSAGES, "42:s9")).toBe("");
  });

  it("returns empty when the message is gone", () => {
    expect(resolveExcerpt(MESSAGES, "99:s0")).toBe("");
  });

  it("returns empty for a malformed key", () => {
    expect(resolveExcerpt(MESSAGES, "no-separator")).toBe("");
  });

  it("returns empty when the id segment is not a row id", () => {
    expect(resolveExcerpt(MESSAGES, "42abc:s0")).toBe("");
  });
});
