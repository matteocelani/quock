// The menu hands back `${messageId}:${unitKey}`; the text is resolved from the loaded reply here, so it is never
// mirrored into the UI store and always matches what the message says now.

import { excerptTextForKey } from "@/components/ui/markdown/excerptText";
import type { DbMessage } from "@/lib/db/types";
import { asMessageId } from "@/lib/types/ids";

export function resolveExcerpt(
  messages: readonly Pick<DbMessage, "id" | "content">[],
  compositeKey: string,
): string {
  const separator = compositeKey.indexOf(":");
  if (separator < 0) return "";
  // The key travels as text, so the row id is branded back before the lookup instead of comparing stringified ids.
  const parsedId = Number(compositeKey.slice(0, separator));
  if (!Number.isInteger(parsedId)) return "";
  const messageId = asMessageId(parsedId);
  const unitKey = compositeKey.slice(separator + 1);
  const message = messages.find((m) => m.id === messageId);
  return message === undefined
    ? ""
    : excerptTextForKey(message.content, unitKey);
}
