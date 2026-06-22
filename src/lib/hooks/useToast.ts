// Surfaces the `show` action from the toast store. Components only ever see this hook so swapping the store implementation does not ripple into call sites.

import { useToastStore, type ToastOptions } from "@/lib/stores/toast.store";

export function useToast(): (options: ToastOptions) => void {
  return useToastStore((s) => s.show);
}
