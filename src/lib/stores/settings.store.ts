// Persistent user preferences (theme, default model name, haptics). Single Zustand store backed by MMKV via the `persist` middleware. Subscribers re-render the moment any field changes — replaces three MMKV-backed contexts/hooks (ThemeContext, useSelectedModel, useHaptics) with one source of truth.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  AGENT_MAX_TOOL_ROUNDS_CHOICES,
  AGENT_MAX_TOOL_ROUNDS_DEFAULT,
} from "@/lib/constants/magic-numbers";
import { mmkvStorage } from "@/lib/stores/mmkv-storage";

export type ThemeMode = "system" | "light" | "dark";

interface SettingsState {
  themeMode: ThemeMode;
  selectedModelName: string | null;
  hapticsEnabled: boolean;
  // Apple 5.1.2(i): epoch ms when the user explicitly consented to sending messages to Ollama Cloud, null until then.
  aiConsentAcceptedAt: number | null;
  // Excerpt-action instructions the user can reword. Null means "use the shipped default", so improving a default
  // reaches everyone instead of being shadowed by a copy written into storage on first launch.
  deepDiveInstruction: string | null;
  webSearchInstruction: string | null;
  // Standing instructions the agent follows in every conversation where agent mode is on. Null = no extra instruction.
  agentInstructions: string | null;
  // Tool-loop ceiling applied to agent sends. Web search keeps its own compile-time cap.
  agentMaxToolRounds: number;
  setThemeMode: (mode: ThemeMode) => void;
  setSelectedModelName: (name: string | null) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  acceptAiConsent: () => void;
  revokeAiConsent: () => void;
  /** Null (or blank) restores the shipped wording. */
  setDeepDiveInstruction: (instruction: string | null) => void;
  setWebSearchInstruction: (instruction: string | null) => void;
  setAgentInstructions: (instruction: string | null) => void;
  setAgentMaxToolRounds: (rounds: number) => void;
}

const DEFAULT_THEME: ThemeMode = "system";
const DEFAULT_HAPTICS = true;

// An instruction the user has blanked is not a valid prompt, so it collapses back to null = the shipped default.
export function normaliseInstruction(
  instruction: string | null,
): string | null {
  const trimmed = instruction?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: DEFAULT_THEME,
      selectedModelName: null,
      hapticsEnabled: DEFAULT_HAPTICS,
      aiConsentAcceptedAt: null,
      deepDiveInstruction: null,
      webSearchInstruction: null,
      agentInstructions: null,
      agentMaxToolRounds: AGENT_MAX_TOOL_ROUNDS_DEFAULT,
      setThemeMode: (themeMode): void => {
        set({ themeMode });
      },
      setSelectedModelName: (selectedModelName): void => {
        set({ selectedModelName });
      },
      setHapticsEnabled: (hapticsEnabled): void => {
        set({ hapticsEnabled });
      },
      acceptAiConsent: (): void => {
        set({ aiConsentAcceptedAt: Date.now() });
      },
      revokeAiConsent: (): void => {
        set({ aiConsentAcceptedAt: null });
      },
      setDeepDiveInstruction: (instruction): void => {
        set({ deepDiveInstruction: normaliseInstruction(instruction) });
      },
      setWebSearchInstruction: (instruction): void => {
        set({ webSearchInstruction: normaliseInstruction(instruction) });
      },
      setAgentInstructions: (instruction): void => {
        set({ agentInstructions: normaliseInstruction(instruction) });
      },
      setAgentMaxToolRounds: (agentMaxToolRounds): void => {
        set({ agentMaxToolRounds });
      },
    }),
    {
      name: "quock.settings",
      storage: createJSONStorage(() => mmkvStorage),
      version: 1,
      // A stale MMKV value (edited by hand or left from an older build) must never break the SegmentedControl
      // that renders only the AGENT_MAX_TOOL_ROUNDS_CHOICES — clamp a foreign value back to the default.
      merge: (persisted, current) => {
        const base = { ...current, ...(persisted as object) } as SettingsState;
        const rounds = (persisted as { agentMaxToolRounds?: unknown })
          ?.agentMaxToolRounds;
        if (
          typeof rounds !== "number" ||
          !(AGENT_MAX_TOOL_ROUNDS_CHOICES as readonly number[]).includes(rounds)
        ) {
          base.agentMaxToolRounds = AGENT_MAX_TOOL_ROUNDS_DEFAULT;
        }
        return base;
      },
      // Only the user-visible prefs persist; action fns are recreated by `create` on each app boot.
      partialize: (state) => ({
        themeMode: state.themeMode,
        selectedModelName: state.selectedModelName,
        hapticsEnabled: state.hapticsEnabled,
        aiConsentAcceptedAt: state.aiConsentAcceptedAt,
        deepDiveInstruction: state.deepDiveInstruction,
        webSearchInstruction: state.webSearchInstruction,
        agentInstructions: state.agentInstructions,
        agentMaxToolRounds: state.agentMaxToolRounds,
      }),
    },
  ),
);
