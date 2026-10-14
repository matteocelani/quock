import {
  AI_CONSENT_VERSION,
  hasCurrentAiConsent,
  normaliseInstruction,
} from "@/lib/stores/settings.store";

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

describe("hasCurrentAiConsent", () => {
  it("is false before any acceptance", () => {
    expect(
      hasCurrentAiConsent({
        aiConsentAcceptedAt: null,
        aiConsentVersion: null,
      }),
    ).toBe(false);
  });

  it("re-shows the gate for an acceptance stored before versions existed", () => {
    expect(
      hasCurrentAiConsent({ aiConsentAcceptedAt: 1, aiConsentVersion: null }),
    ).toBe(false);
  });

  it("re-shows the gate for an older wording", () => {
    expect(
      hasCurrentAiConsent({ aiConsentAcceptedAt: 1, aiConsentVersion: 1 }),
    ).toBe(false);
  });

  it("holds for the current wording", () => {
    expect(
      hasCurrentAiConsent({
        aiConsentAcceptedAt: 1,
        aiConsentVersion: AI_CONSENT_VERSION,
      }),
    ).toBe(true);
  });
});
