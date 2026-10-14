import type { DbMemoryFact } from "@/lib/db/types";
import { asFactId } from "@/lib/types/ids";
import { MEMORY_SECRET_MIN_TOKEN_CHARS } from "@/modules/chat/constants";
import {
  checkForget,
  checkRemember,
  hasUntrustedHistory,
  MEMORY_REPLIES,
  type MemoryTurnState,
  normalizeFactKey,
} from "@/modules/chat/lib/memoryGate";

function fact(id: number, content: string, createdAt = id): DbMemoryFact {
  return { id: asFactId(id), content, createdAt };
}

const CLEAN: MemoryTurnState = {
  hasUntrustedContext: false,
  hasRunWebTool: false,
  savedThisTurn: 0,
};

describe("checkRemember", () => {
  it("accepts a fact and stores it on one line", () => {
    expect(checkRemember("  Lives in\nBergamo  ", [], CLEAN)).toEqual({
      isAccepted: true,
      text: "Lives in Bergamo",
    });
  });

  it("is read-only after a web tool ran in this reply", () => {
    expect(
      checkRemember("Lives in Rome", [], { ...CLEAN, hasRunWebTool: true }),
    ).toEqual({ isAccepted: false, reply: MEMORY_REPLIES.readOnly });
  });

  it("is read-only in a chat that replays an attachment", () => {
    expect(
      checkRemember("Lives in Rome", [], {
        ...CLEAN,
        hasUntrustedContext: true,
      }),
    ).toEqual({ isAccepted: false, reply: MEMORY_REPLIES.readOnly });
  });

  // Provenance outranks dedup, so a poisoned turn cannot probe which notes exist.
  it("answers read-only before revealing a duplicate", () => {
    expect(
      checkRemember("Likes tea", [fact(1, "Likes tea")], {
        ...CLEAN,
        hasRunWebTool: true,
      }),
    ).toEqual({ isAccepted: false, reply: MEMORY_REPLIES.readOnly });
  });

  it("stops at the per-reply save limit", () => {
    expect(
      checkRemember("Likes tea", [], { ...CLEAN, savedThisTurn: 2 }),
    ).toEqual({ isAccepted: false, reply: MEMORY_REPLIES.saveLimit });
  });

  it("rejects a non-string or blank fact as empty", () => {
    expect(checkRemember(42, [], CLEAN)).toEqual({
      isAccepted: false,
      reply: MEMORY_REPLIES.empty,
    });
    expect(checkRemember(" \n ", [], CLEAN)).toEqual({
      isAccepted: false,
      reply: MEMORY_REPLIES.empty,
    });
  });

  // Spaced words, since one unbroken 200-letter run would read as a key and trip the secret check first.
  it("accepts exactly the length cap and rejects one over it, never truncating", () => {
    const atCap = `${"aaaaaaaaa ".repeat(19)}aaaaaaaaaa`;
    expect(Array.from(atCap)).toHaveLength(200);
    expect(checkRemember(atCap, [], CLEAN)).toEqual({
      isAccepted: true,
      text: atCap,
    });
    expect(checkRemember(`${atCap}a`, [], CLEAN)).toEqual({
      isAccepted: false,
      reply: MEMORY_REPLIES.tooLong(201),
    });
  });

  it("counts code points, so 200 emoji fit", () => {
    expect(checkRemember("😀".repeat(200), [], CLEAN).isAccepted).toBe(true);
  });

  it("rejects a card number and a key-shaped token", () => {
    expect(checkRemember("Card 4111111111111111", [], CLEAN)).toEqual({
      isAccepted: false,
      reply: MEMORY_REPLIES.secret,
    });
    expect(
      checkRemember(
        `Key ${"a1".repeat(MEMORY_SECRET_MIN_TOKEN_CHARS)}`,
        [],
        CLEAN,
      ),
    ).toEqual({ isAccepted: false, reply: MEMORY_REPLIES.secret });
  });

  it("rejects a normalized duplicate and names the stored id", () => {
    expect(
      checkRemember(
        "prefers  METRIC units",
        [fact(7, "Prefers metric units.")],
        CLEAN,
      ),
    ).toEqual({
      isAccepted: false,
      reply: MEMORY_REPLIES.duplicate(asFactId(7)),
    });
  });
});

describe("normalizeFactKey", () => {
  it("folds width, case and a closing full stop", () => {
    expect(normalizeFactKey("Ｐrefers metric units！")).toBe(
      "prefers metric units",
    );
  });

  it("keeps facts that differ in meaning apart", () => {
    expect(normalizeFactKey("Lives in Milan")).not.toBe(
      normalizeFactKey("Lived in Milan"),
    );
  });
});

describe("hasUntrustedHistory", () => {
  const typed = { hasReadWeb: false };
  const searched = { hasReadWeb: true };

  it("trusts a chat the user only typed into", () => {
    expect(hasUntrustedHistory([typed, typed], 0)).toBe(false);
  });

  it("distrusts a chat that replays an attachment", () => {
    expect(hasUntrustedHistory([typed], 1)).toBe(true);
  });

  it("distrusts a chat where any earlier turn read the web", () => {
    expect(hasUntrustedHistory([searched, typed, typed], 0)).toBe(true);
  });
});

describe("checkForget", () => {
  const existing = [fact(3, "Likes tea")];

  it("accepts a known id as a number or a numeric string", () => {
    expect(checkForget(3, existing, CLEAN)).toEqual({
      isAccepted: true,
      id: asFactId(3),
    });
    expect(checkForget(" 3 ", existing, CLEAN)).toEqual({
      isAccepted: true,
      id: asFactId(3),
    });
  });

  it("is read-only in an untrusted turn", () => {
    expect(checkForget(3, existing, { ...CLEAN, hasRunWebTool: true })).toEqual(
      { isAccepted: false, reply: MEMORY_REPLIES.forgetReadOnly },
    );
  });

  it("rejects a malformed id", () => {
    expect(checkForget("3a", existing, CLEAN)).toEqual({
      isAccepted: false,
      reply: MEMORY_REPLIES.badId,
    });
    expect(checkForget(0, existing, CLEAN)).toEqual({
      isAccepted: false,
      reply: MEMORY_REPLIES.badId,
    });
  });

  it("rejects an id this account does not hold", () => {
    expect(checkForget(9, existing, CLEAN)).toEqual({
      isAccepted: false,
      reply: MEMORY_REPLIES.unknownId(asFactId(9)),
    });
  });
});
