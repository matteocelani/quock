// Per-chat streaming state: which chats are mid-stream, their AbortControllers, and the cloud-side download progress. Replaces the previous `StreamingProvider` + useReducer. Mutations rebuild the Set/Map so selective subscribers (e.g. `useIsStreaming(chatId)`) re-render only when their target id flips.

import { create } from "zustand";
import type { ChatId } from "@/lib/types/ids";

export interface DownloadProgress {
  total: number;
  completed: number;
  done: boolean;
}

// Surfaced while an agentic tool runs mid-stream so the assistant row can show "Searching for {query}…". `query` doubles as the fetched URL for web_fetch.
export interface ToolActivity {
  name: string;
  query: string;
}

interface StreamingState {
  streamingChatIds: ReadonlySet<ChatId>;
  abortControllers: ReadonlyMap<ChatId, AbortController>;
  downloadProgress: ReadonlyMap<ChatId, DownloadProgress>;
  toolActivity: ReadonlyMap<ChatId, ToolActivity>;
  startStream: (chatId: ChatId, controller: AbortController) => void;
  endStream: (chatId: ChatId) => void;
  updateProgress: (chatId: ChatId, progress: DownloadProgress) => void;
  setToolActivity: (chatId: ChatId, activity: ToolActivity | null) => void;
  abort: (chatId: ChatId) => void;
}

export const useStreamingStore = create<StreamingState>((set, get) => ({
  streamingChatIds: new Set<ChatId>(),
  abortControllers: new Map<ChatId, AbortController>(),
  downloadProgress: new Map<ChatId, DownloadProgress>(),
  toolActivity: new Map<ChatId, ToolActivity>(),
  startStream: (chatId, controller): void => {
    const streamingChatIds = new Set(get().streamingChatIds);
    streamingChatIds.add(chatId);
    const abortControllers = new Map(get().abortControllers);
    abortControllers.set(chatId, controller);
    set({ streamingChatIds, abortControllers });
  },
  endStream: (chatId): void => {
    const streamingChatIds = new Set(get().streamingChatIds);
    streamingChatIds.delete(chatId);
    const abortControllers = new Map(get().abortControllers);
    abortControllers.delete(chatId);
    const downloadProgress = new Map(get().downloadProgress);
    downloadProgress.delete(chatId);
    const toolActivity = new Map(get().toolActivity);
    toolActivity.delete(chatId);
    set({ streamingChatIds, abortControllers, downloadProgress, toolActivity });
  },
  updateProgress: (chatId, progress): void => {
    const downloadProgress = new Map(get().downloadProgress);
    downloadProgress.set(chatId, progress);
    set({ downloadProgress });
  },
  setToolActivity: (chatId, activity): void => {
    const toolActivity = new Map(get().toolActivity);
    if (activity === null) {
      toolActivity.delete(chatId);
    } else {
      toolActivity.set(chatId, activity);
    }
    set({ toolActivity });
  },
  abort: (chatId): void => {
    const controller = get().abortControllers.get(chatId);
    if (controller) {
      controller.abort();
    }
    get().endStream(chatId);
  },
}));
