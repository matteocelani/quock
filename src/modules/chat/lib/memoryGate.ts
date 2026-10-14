// Save gate for the memory tools. Pure so Jest covers what SQLite cannot, and enforced in code rather than by prompt:
// a model told not to save from web pages still can, so the reply's provenance decides, not the model's judgement.

import type { DbMemoryFact, DbMessage } from "@/lib/db/types";
import { asFactId, type FactId } from "@/lib/types/ids";
import {
  MEMORY_FACT_MAX_CHARS,
  MEMORY_MAX_SAVES_PER_TURN,
  MEMORY_SECRET_MIN_DIGITS,
  MEMORY_SECRET_MIN_TOKEN_CHARS,
} from "@/modules/chat/constants";

// Provenance of the reply being written; any text the user did not type makes memory read-only for the rest of it.
export interface MemoryTurnState {
  // The chat replays text the user did not type: see hasUntrustedHistory.
  hasUntrustedContext: boolean;
  // A web_search or web_fetch call ran earlier in this reply, so page text is in the model's context.
  hasRunWebTool: boolean;
  savedThisTurn: number;
}

export type RememberVerdict =
  | { isAccepted: true; text: string }
  | { isAccepted: false; reply: string };

export type ForgetVerdict =
  | { isAccepted: true; id: FactId }
  | { isAccepted: false; reply: string };

// A long digit run or an unbroken token reads as a card number or a key, which would replay to the cloud on every send.
const SECRET_PATTERN = new RegExp(
  `\\d{${MEMORY_SECRET_MIN_DIGITS},}|[A-Za-z0-9_+=-]{${MEMORY_SECRET_MIN_TOKEN_CHARS},}`,
);

// Tool results are the model's only feedback, so each reply says whether a retry can succeed.
export const MEMORY_REPLIES = {
  readOnly:
    "Not saved: memory is read-only in a turn that used a web page, a search result or an attached file. Do not retry; continue your answer.",
  forgetReadOnly:
    "Not removed: memory is read-only in a turn that used a web page, a search result or an attached file. Do not retry; continue your answer.",
  saveLimit: `Not saved: at most ${MEMORY_MAX_SAVES_PER_TURN} facts can be saved per reply. Do not retry; continue your answer.`,
  empty: "Not saved: the fact is empty.",
  tooLong: (length: number): string =>
    `Not saved: the fact is ${length} characters and the limit is ${MEMORY_FACT_MAX_CHARS}. Rewrite it as one shorter sentence and call remember_fact again.`,
  secret:
    "Not saved: it looks like a number or key. Never save credentials, codes, or card or account numbers.",
  duplicate: (id: FactId): string =>
    `Already remembered as id ${id}. Nothing was saved.`,
  saved: (id: FactId): string => `Saved as id ${id}.`,
  noIds:
    "Nothing deleted: pass the ids of facts from the notes about the user.",
  badId:
    "Not removed: an id must be the number of a fact in the notes about the user.",
  unknownId: (id: FactId): string =>
    `Not removed: there is no fact with id ${id}.`,
  removed: (id: FactId): string => `Removed id ${id}.`,
  unavailable: "Memory is unavailable right now; continue without it.",
} as const;

// Stored form: one line, outer whitespace dropped. Collapsing whitespace keeps the JSON block tidy and is not truncation.
export function cleanFact(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

// Comparison key only, never stored: width, case, spacing and a closing full stop must not make a second copy.
export function normalizeFactKey(text: string): string {
  return cleanFact(text.normalize("NFKC").toLowerCase()).replace(
    /[\s.!…。！]+$/u,
    "",
  );
}

// Chat-level, because toWireHistory replays every earlier turn: a document, or an answer written from a web page, keeps
// steering the model in every later reply. Web search merely switched on reads nothing, so it never counts on its own.
export function hasUntrustedHistory(
  history: readonly Pick<DbMessage, "hasReadWeb">[],
  attachmentCount: number,
): boolean {
  return attachmentCount > 0 || history.some((m) => m.hasReadWeb);
}

export function isMemoryReadOnly(turn: MemoryTurnState): boolean {
  return turn.hasUntrustedContext || turn.hasRunWebTool;
}

// Provenance first, so an untrusted turn learns nothing about stored notes (not even a duplicate's id).
export function checkRemember(
  rawFact: unknown,
  existing: readonly DbMemoryFact[],
  turn: MemoryTurnState,
): RememberVerdict {
  if (isMemoryReadOnly(turn)) {
    return { isAccepted: false, reply: MEMORY_REPLIES.readOnly };
  }
  if (turn.savedThisTurn >= MEMORY_MAX_SAVES_PER_TURN) {
    return { isAccepted: false, reply: MEMORY_REPLIES.saveLimit };
  }
  const text = typeof rawFact === "string" ? cleanFact(rawFact) : "";
  if (text.length === 0) {
    return { isAccepted: false, reply: MEMORY_REPLIES.empty };
  }
  // Code points, not UTF-16 units, so an emoji or an accented name costs one character, as the model counts it.
  const length = Array.from(text).length;
  if (length > MEMORY_FACT_MAX_CHARS) {
    return { isAccepted: false, reply: MEMORY_REPLIES.tooLong(length) };
  }
  if (SECRET_PATTERN.test(text)) {
    return { isAccepted: false, reply: MEMORY_REPLIES.secret };
  }
  const key = normalizeFactKey(text);
  const twin = existing.find((f) => normalizeFactKey(f.content) === key);
  if (twin) {
    return { isAccepted: false, reply: MEMORY_REPLIES.duplicate(twin.id) };
  }
  return { isAccepted: true, text };
}

function parseFactId(raw: unknown): FactId | null {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : Number.NaN;
  return Number.isSafeInteger(value) && value > 0 ? asFactId(value) : null;
}

export function checkForget(
  rawId: unknown,
  existing: readonly DbMemoryFact[],
  turn: MemoryTurnState,
): ForgetVerdict {
  if (isMemoryReadOnly(turn)) {
    return { isAccepted: false, reply: MEMORY_REPLIES.forgetReadOnly };
  }
  const id = parseFactId(rawId);
  if (id === null) return { isAccepted: false, reply: MEMORY_REPLIES.badId };
  if (!existing.some((f) => f.id === id)) {
    return { isAccepted: false, reply: MEMORY_REPLIES.unknownId(id) };
  }
  return { isAccepted: true, id };
}
