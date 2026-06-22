// Branded ID types prevent accidental mixing of different ID flavours across the persistence layer and the rest of the app.

import * as Crypto from "expo-crypto";

export type ChatId = string & { readonly __brand: "ChatId" };

export type MessageId = number & { readonly __brand: "MessageId" };

export type AttachmentId = number & { readonly __brand: "AttachmentId" };

export function asChatId(value: string): ChatId {
  return value as ChatId;
}

export function asMessageId(value: number): MessageId {
  return value as MessageId;
}

export function asAttachmentId(value: number): AttachmentId {
  return value as AttachmentId;
}
// Uses expo-crypto so UUID generation works identically on iOS, Android and web.
export function newChatId(): ChatId {
  return asChatId(Crypto.randomUUID());
}
