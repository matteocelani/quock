// Pulls of on-device models in flight. Volatile by nature: a pull that outlives the process is resumed by the native
// store, file by file, the next time the user taps the model.

import { create } from "zustand";

export interface OnDeviceDownload {
  completed: number;
  total: number;
  hasFailed: boolean;
}

interface OnDeviceDownloadsState {
  downloads: ReadonlyMap<string, OnDeviceDownload>;
  setProgress: (model: string, completed: number, total: number) => void;
  setFailed: (model: string) => void;
  clear: (model: string) => void;
}

export const useOnDeviceDownloadsStore = create<OnDeviceDownloadsState>(
  (set) => ({
    downloads: new Map<string, OnDeviceDownload>(),
    setProgress: (model, completed, total): void => {
      set((state) => {
        const next = new Map(state.downloads);
        next.set(model, { completed, total, hasFailed: false });
        return { downloads: next };
      });
    },
    setFailed: (model): void => {
      set((state) => {
        const previous = state.downloads.get(model);
        const next = new Map(state.downloads);
        next.set(model, {
          completed: previous?.completed ?? 0,
          total: previous?.total ?? 0,
          hasFailed: true,
        });
        return { downloads: next };
      });
    },
    clear: (model): void => {
      set((state) => {
        const next = new Map(state.downloads);
        next.delete(model);
        return { downloads: next };
      });
    },
  }),
);
