// Persistent user preferences (theme, default model name, haptics, memory). Single Zustand store backed by MMKV via the `persist` middleware. Subscribers re-render the moment any field changes — replaces three MMKV-backed contexts/hooks (ThemeContext, useSelectedModel, useHaptics) with one source of truth.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mmkvStorage } from "@/lib/stores/mmkv-storage";

export type ThemeMode = "system" | "light" | "dark";

interface SettingsState {
  themeMode: ThemeMode;
  selectedModelName: string | null;
  hapticsEnabled: boolean;
  // Apple 5.1.2(i): epoch ms when the user explicitly consented to sending messages to Ollama Cloud, null until then.
  aiConsentAcceptedAt: number | null;
  // Which consent wording was accepted. Null on acceptances stored before versions existed, so they see the gate once more.
  aiConsentVersion: number | null;
  // On by default; off only stops memory being offered or injected, it never deletes the stored facts.
  isMemoryEnabled: boolean;
  // Excerpt-action instructions the user can reword. Null means "use the shipped default", so improving a default
  // reaches everyone instead of being shadowed by a copy written into storage on first launch.
  deepDiveInstruction: string | null;
  webSearchInstruction: string | null;
  setThemeMode: (mode: ThemeMode) => void;
  setSelectedModelName: (name: string | null) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setMemoryEnabled: (isMemoryEnabled: boolean) => void;
  acceptAiConsent: () => void;
  revokeAiConsent: () => void;
  /** Null (or blank) restores the shipped wording. */
  setDeepDiveInstruction: (instruction: string | null) => void;
  setWebSearchInstruction: (instruction: string | null) => void;
}

const DEFAULT_THEME: ThemeMode = "system";
const DEFAULT_HAPTICS = true;
const DEFAULT_MEMORY = true;
// Bumped when the consent text gains a new category of processing (PRIVACY.md §10); 2 added on-device memory.
export const AI_CONSENT_VERSION = 2;

// Consent counts only for the current wording, so a bumped version re-shows the gate without touching anything else.
export function hasCurrentAiConsent(
  state: Pick<SettingsState, "aiConsentAcceptedAt" | "aiConsentVersion">,
): boolean {
  return (
    state.aiConsentAcceptedAt !== null &&
    state.aiConsentVersion !== null &&
    state.aiConsentVersion >= AI_CONSENT_VERSION
  );
}

// An instruction the user has blanked is not a valid prompt, so it collapses back to null = the shipped default.
export function normaliseInstruction(instruction: string | null): string | null {
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
      aiConsentVersion: null,
      isMemoryEnabled: DEFAULT_MEMORY,
      deepDiveInstruction: null,
      webSearchInstruction: null,
      setThemeMode: (themeMode): void => {
        set({ themeMode });
      },
      setSelectedModelName: (selectedModelName): void => {
        set({ selectedModelName });
      },
      setHapticsEnabled: (hapticsEnabled): void => {
        set({ hapticsEnabled });
      },
      setMemoryEnabled: (isMemoryEnabled): void => {
        set({ isMemoryEnabled });
      },
      acceptAiConsent: (): void => {
        set({
          aiConsentAcceptedAt: Date.now(),
          aiConsentVersion: AI_CONSENT_VERSION,
        });
      },
      revokeAiConsent: (): void => {
        set({ aiConsentAcceptedAt: null, aiConsentVersion: null });
      },
      setDeepDiveInstruction: (instruction): void => {
        set({ deepDiveInstruction: normaliseInstruction(instruction) });
      },
      setWebSearchInstruction: (instruction): void => {
        set({ webSearchInstruction: normaliseInstruction(instruction) });
      },
    }),
    {
      name: "quock.settings",
      storage: createJSONStorage(() => mmkvStorage),
      // Stays 1: new fields need no migrate fn, the default merge fills them; a bump without one discards stored state.
      version: 1,
      // Only the user-visible prefs persist; action fns are recreated by `create` on each app boot.
      partialize: (state) => ({
        themeMode: state.themeMode,
        selectedModelName: state.selectedModelName,
        hapticsEnabled: state.hapticsEnabled,
        aiConsentAcceptedAt: state.aiConsentAcceptedAt,
        aiConsentVersion: state.aiConsentVersion,
        isMemoryEnabled: state.isMemoryEnabled,
        deepDiveInstruction: state.deepDiveInstruction,
        webSearchInstruction: state.webSearchInstruction,
      }),
    },
  ),
);
