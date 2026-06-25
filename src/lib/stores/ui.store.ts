// Cross-component UI navigation state: sheet visibility, upgrade modal, model-picker mode. Avoids prop-drilling through ChatHome.

import { create } from "zustand";
import { timingsNamed } from "@/lib/design/tokens";

// "default" → the picker writes to settings.store.selectedModelName (persisted user preference).
// "current" → the picker pins the choice to the open chat (chats.model, via useChatModel).
export type ModelPickerMode = "default" | "current";

interface UIState {
  // Sheet visibility — the four chat-home sheets render unconditionally and pay their mount cost once at boot; only their `visible` flag toggles.
  chatHistoryOpen: boolean;
  modelPickerOpen: boolean;
  modelPickerMode: ModelPickerMode;
  accountOpen: boolean;
  attachOpen: boolean;
  // # of mounted sheet Modals; the main-tree toast viewport hides while > 0 so only the sheet-hosted one paints (else both render and the main one bleeds through the scrim blur as a faded duplicate).
  openSheetCount: number;
  pushSheet: () => void;
  popSheet: () => void;
  // Upgrade modal — surfaced when Composer catches a `subscription_required` API error, owns the offending model name to render the CTA text.
  upgradeModalOpen: boolean;
  upgradeModalModelName: string;
  // Sheet toggles
  openChatHistory: () => void;
  closeChatHistory: () => void;
  openModelPicker: () => void;
  closeModelPicker: () => void;
  openAccount: () => void;
  closeAccount: () => void;
  openAttach: () => void;
  closeAttach: () => void;
  // Choreographed transitions: close the current sheet, then schedule the next after `timingsNamed.sheetCloseTail` so the two animations do not stack and stutter.
  switchToModelPickerFromAccount: () => void;
  // Upgrade modal
  openUpgradeModal: (modelName: string) => void;
  closeUpgradeModal: () => void;
  pickAnotherFromUpgrade: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  chatHistoryOpen: false,
  modelPickerOpen: false,
  modelPickerMode: "current",
  accountOpen: false,
  attachOpen: false,
  openSheetCount: 0,
  upgradeModalOpen: false,
  upgradeModalModelName: "",
  openChatHistory: (): void => {
    set({ chatHistoryOpen: true });
  },
  closeChatHistory: (): void => {
    set({ chatHistoryOpen: false });
  },
  // Header tap → current-chat override.
  openModelPicker: (): void => {
    set({ modelPickerOpen: true, modelPickerMode: "current" });
  },
  closeModelPicker: (): void => {
    set({ modelPickerOpen: false });
  },
  openAccount: (): void => {
    set({ accountOpen: true });
  },
  closeAccount: (): void => {
    set({ accountOpen: false });
  },
  openAttach: (): void => {
    set({ attachOpen: true });
  },
  closeAttach: (): void => {
    set({ attachOpen: false });
  },
  pushSheet: (): void => {
    set((s) => ({ openSheetCount: s.openSheetCount + 1 }));
  },
  popSheet: (): void => {
    set((s) => ({ openSheetCount: Math.max(0, s.openSheetCount - 1) }));
  },
  // Settings → Default model → opens the picker in "default" mode so a pick rewrites the persisted preference, not the per-chat override.
  switchToModelPickerFromAccount: (): void => {
    set({ accountOpen: false });
    setTimeout(() => {
      set({ modelPickerOpen: true, modelPickerMode: "default" });
    }, timingsNamed.sheetCloseTail);
  },
  openUpgradeModal: (modelName): void => {
    set({ upgradeModalOpen: true, upgradeModalModelName: modelName });
  },
  closeUpgradeModal: (): void => {
    set({ upgradeModalOpen: false });
  },
  // Upgrade gate fires per-message; opening the picker here scopes the new pick to the current chat, not the persisted default.
  pickAnotherFromUpgrade: (): void => {
    set({ upgradeModalOpen: false });
    setTimeout(() => {
      set({ modelPickerOpen: true, modelPickerMode: "current" });
    }, timingsNamed.sheetCloseTail);
  },
}));
