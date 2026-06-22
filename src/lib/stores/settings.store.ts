// Persistent user preferences (theme, default model name, haptics). Single Zustand store backed by MMKV via the `persist` middleware. Subscribers re-render the moment any field changes — replaces three MMKV-backed contexts/hooks (ThemeContext, useSelectedModel, useHaptics) with one source of truth.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mmkvStorage } from "@/lib/stores/mmkv-storage";

export type ThemeMode = "system" | "light" | "dark";

interface SettingsState {
  themeMode: ThemeMode;
  selectedModelName: string | null;
  hapticsEnabled: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setSelectedModelName: (name: string | null) => void;
  setHapticsEnabled: (enabled: boolean) => void;
}

const DEFAULT_THEME: ThemeMode = "system";
const DEFAULT_HAPTICS = true;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: DEFAULT_THEME,
      selectedModelName: null,
      hapticsEnabled: DEFAULT_HAPTICS,
      setThemeMode: (themeMode): void => {
        set({ themeMode });
      },
      setSelectedModelName: (selectedModelName): void => {
        set({ selectedModelName });
      },
      setHapticsEnabled: (hapticsEnabled): void => {
        set({ hapticsEnabled });
      },
    }),
    {
      name: "quock.settings",
      storage: createJSONStorage(() => mmkvStorage),
      version: 1,
      // Only the user-visible prefs persist; action fns are recreated by `create` on each app boot.
      partialize: (state) => ({
        themeMode: state.themeMode,
        selectedModelName: state.selectedModelName,
        hapticsEnabled: state.hapticsEnabled,
      }),
    },
  ),
);
