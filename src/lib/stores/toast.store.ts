// Toast queue as a volatile Zustand store. Replaces the previous `<ToastProvider>` Context wiring — the viewport (rendered in `_layout.tsx`) now reads the queue selectively, and call sites push via `useToast()`. Auto-dismiss timers live in a module-level Map so they survive React tree changes but never leak across stores.

import { create } from "zustand";

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
}

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
}

const DEFAULT_DURATION_MS = 3000;

interface ToastState {
  items: readonly ToastItem[];
  show: (options: ToastOptions) => void;
  dismiss: (id: number) => void;
}
// Module-level timer registry so dismissals can clean up after the timeout fires; map key is the toast id, value is the Node/RN timeout handle.
const timers: Map<number, ReturnType<typeof setTimeout>> = new Map();
let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  show: (options): void => {
    const id = nextId++;
    const item: ToastItem = {
      id,
      title: options.title,
      tone: options.tone ?? "info",
      duration: options.duration ?? DEFAULT_DURATION_MS,
    };
    if (options.description !== undefined) {
      item.description = options.description;
    }
    set({ items: [...get().items, item] });
    const timer = setTimeout(() => {
      get().dismiss(id);
    }, item.duration);
    timers.set(id, timer);
  },
  dismiss: (id): void => {
    set({ items: get().items.filter((t) => t.id !== id) });
    const t = timers.get(id);
    if (t) {
      clearTimeout(t);
      timers.delete(id);
    }
  },
}));
