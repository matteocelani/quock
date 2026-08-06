// Cross-component UI navigation state: sheet visibility, select-text sheet, model-picker mode. Avoids prop-drilling through ChatHome.

import { create } from "zustand";
import { timingsNamed } from "@/lib/design/tokens";
import type { AnchorRect } from "@/lib/types/geometry";
import type { MessageId } from "@/lib/types/ids";

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
  // Select-text sheet — the in-list Markdown can't be selected (FlashList + Fabric swallow the long-press), so this lifts one reply into a sheet where native selection works. Holds the message id; content is resolved from the query cache, never mirrored here.
  selectTextOpen: boolean;
  selectTextMessageId: MessageId | null;
  // Excerpt menu — long-pressing a reply unit pops a floating toolbar (Deep dive / Web search) anchored to it.
  excerptMenuOpen: boolean;
  // Key of the highlighted unit (`messageId:unitKey`): the reply tints exactly the acted-on section, and the text is
  // resolved from the chat cache when an action fires — never mirrored here, as the select-text sheet above.
  excerptMenuKey: string;
  excerptMenuAnchor: AnchorRect;
  // Sheet toggles
  openChatHistory: () => void;
  closeChatHistory: () => void;
  openModelPicker: () => void;
  closeModelPicker: () => void;
  openAccount: () => void;
  closeAccount: () => void;
  openAttach: () => void;
  closeAttach: () => void;
  openSelectText: (messageId: MessageId) => void;
  closeSelectText: () => void;
  openExcerptMenu: (key: string, anchor: AnchorRect) => void;
  closeExcerptMenu: () => void;
  /** Drops the highlight once the menu's exit animation has finished, not when it starts. */
  clearExcerptHighlight: () => void;
  // Choreographed transitions: close the current sheet, then schedule the next after `timingsNamed.sheetCloseTail` so the two animations do not stack and stutter.
  switchToModelPickerFromAccount: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  chatHistoryOpen: false,
  modelPickerOpen: false,
  modelPickerMode: "current",
  accountOpen: false,
  attachOpen: false,
  openSheetCount: 0,
  selectTextOpen: false,
  selectTextMessageId: null,
  excerptMenuOpen: false,
  excerptMenuKey: "",
  excerptMenuAnchor: { top: 0, bottom: 0, left: 0, width: 0 },
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
  openSelectText: (messageId): void => {
    set({ selectTextOpen: true, selectTextMessageId: messageId });
  },
  closeSelectText: (): void => {
    set({ selectTextOpen: false });
  },
  openExcerptMenu: (key, anchor): void => {
    set({ excerptMenuOpen: true, excerptMenuKey: key, excerptMenuAnchor: anchor });
  },
  closeExcerptMenu: (): void => {
    set({ excerptMenuOpen: false });
  },
  clearExcerptHighlight: (): void => {
    set({ excerptMenuKey: "" });
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
}));
