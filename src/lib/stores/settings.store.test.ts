import { normaliseInstruction } from "@/lib/stores/settings.store";

describe("normaliseInstruction", () => {
  it("keeps a real instruction, trimmed", () => {
    expect(normaliseInstruction("  Expand this  ")).toBe("Expand this");
  });

  it("collapses blank input to null so the shipped default applies", () => {
    expect(normaliseInstruction("")).toBeNull();
    expect(normaliseInstruction("   \n\t ")).toBeNull();
    expect(normaliseInstruction(null)).toBeNull();
  });
});
