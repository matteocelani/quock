// Tells the user an answer finished while Quock was away. iOS only: Android freezes a cached app within seconds, so a
// stream there almost never reaches "complete" in the background, and the module is absent (null) there and in Jest.

import { requireOptionalNativeModule } from "expo";
import { asChatId, type ChatId } from "@/lib/types/ids";

interface AnswerNotificationModule {
  requestPermission: () => Promise<boolean>;
  post: (body: string, chatId: string) => Promise<void>;
  takeOpenedChatId: () => Promise<string | null>;
  addListener: (
    eventName: "onOpenChat",
    listener: () => void,
  ) => {
    remove: () => void;
  };
}

// Fixed and content-free on purpose: a chat title or excerpt would sit on the lock screen for anyone to read.
const ANSWER_READY_BODY = "Your answer is ready.";

const native =
  requireOptionalNativeModule<AnswerNotificationModule>("AnswerNotification");

/** False where the native module is not built, so the setting can hide instead of offering a switch that does nothing. */
export const isAnswerNotificationSupported = native !== null;

/** Asks iOS once; a later denial in iOS Settings is answered without a prompt. */
export async function requestAnswerNotificationPermission(): Promise<boolean> {
  if (native === null) return false;
  return native.requestPermission();
}

/** Never throws: a lost banner must not turn a finished answer into a failed one. */
export async function notifyAnswerReady(chatId: ChatId): Promise<void> {
  try {
    await native?.post(ANSWER_READY_BODY, chatId);
  } catch (err) {
    console.warn("[chat] answer notification failed:", err);
  }
}

/** The chat whose notification the user tapped, handed out once. Never throws: a lost tap only means no jump. */
export async function takeOpenedChatId(): Promise<ChatId | null> {
  try {
    const chatId = (await native?.takeOpenedChatId()) ?? null;
    return chatId === null ? null : asChatId(chatId);
  } catch (err) {
    console.warn("[chat] reading the tapped notification failed:", err);
    return null;
  }
}

/** Fires when a notification is tapped while the app is still running; read the chat with `takeOpenedChatId`. */
export function addOpenedChatListener(listener: () => void): () => void {
  const subscription = native?.addListener("onOpenChat", listener);
  return () => subscription?.remove();
}
