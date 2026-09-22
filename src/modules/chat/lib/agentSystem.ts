// Builds the wire-only system context for an agent-mode send: base tool contract, optional user instructions, top-N
// memories. Wire-only — streamPipeline injects it at the head of every round; toWireHistory never reads it back.

import type { DbMemory } from "@/lib/db/types";
import type { WireChatMessage } from "@/modules/chat/api/chat";
import { AGENT_MEMORY_INJECT_MAX } from "@/modules/chat/constants";

// One memory line max: the injector caps the BLOCK at AGENT_MEMORY_INJECT_MAX lines; this caps each line so a single
// over-long save can't crowd out the rest of the hot set.
const MEMORY_LINE_MAX_CHARS = 200;

// The contract the model sees before any user context: tool availability, when each tool family is for, and the
// anti-loop rule (memory_read never returns an error, so a zero result means "no memories", not "try again").
const BASE_CONTRACT = `You are running in agent mode with on-device tools available.
- Use memory_save when the user states a durable fact, preference, or something to remember. Use memory_read to recall them.
- Use memory_forget to delete a saved fact by id when the user asks or it becomes stale.
- Clipboard, haptics, device info, open-url, share, and file scratchpad tools are available; prefer them when the user asks for those actions.
- Otherwise answer normally. Do not announce tool availability out loud; just use them when relevant.`;

export function buildAgentSystemMessages(
  memories: readonly DbMemory[],
  customInstructions: string | null,
): WireChatMessage[] {
  const sections: string[] = [BASE_CONTRACT];
  const instructions = customInstructions?.trim() ?? "";
  if (instructions.length > 0) {
    sections.push(`[Agent instructions]\n${instructions}`);
  }
  const lines = memories
    .slice(0, AGENT_MEMORY_INJECT_MAX)
    .map((m) => `- ${m.content.trim().slice(0, MEMORY_LINE_MAX_CHARS)}`);
  if (lines.length > 0) {
    sections.push(`[Memory]\n${lines.join("\n")}`);
  }
  return [{ role: "system", content: sections.join("\n\n") }];
}
