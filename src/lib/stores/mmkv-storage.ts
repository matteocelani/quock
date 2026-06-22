// MMKV-backed StateStorage adapter for `zustand/middleware/persist`. One MMKV instance per app (`quock.zustand`), keyed by each persisted store's `name` so collisions are impossible across stores.

import { createMMKV } from "react-native-mmkv";
import type { StateStorage } from "zustand/middleware";

// Shared instance keeps the on-disk file count to one; per-store separation comes from the persist `name`.
const mmkv = createMMKV({ id: "quock.zustand" });

// Native MMKV calls can throw if the store is corrupt/inaccessible. The persist middleware reads these at
// startup, so an unguarded throw would crash the app on launch — degrade to "no persisted value" instead.
export const mmkvStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return mmkv.getString(name) ?? null;
    } catch (err) {
      console.warn("mmkvStorage.getItem failed", err);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      mmkv.set(name, value);
    } catch (err) {
      console.warn("mmkvStorage.setItem failed", err);
    }
  },
  removeItem: (name: string): void => {
    try {
      mmkv.remove(name);
    } catch (err) {
      console.warn("mmkvStorage.removeItem failed", err);
    }
  },
};
