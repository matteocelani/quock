// In-flight UI attachment shape used by AttachSheet, Composer, ChatHome, useSendMessage. The DB layer narrows to DbAttachment via the repository.

// `ready` chips are sendable; `invalid` chips render red and block the send button.
export type UiAttachmentStatus = "ready" | "invalid";
export type UiAttachmentInvalidReason =
  | "too_large"
  | "unsupported_type"
  | "vision_required";

export interface UiAttachment {
  // Stable per-pick id (unique even when the same file is attached twice) — used as the React list key.
  id: string;
  filename: string;
  data: Uint8Array;
  uri: string;
  mimeType?: string;
  sizeBytes: number;
  status: UiAttachmentStatus;
  invalidReason?: UiAttachmentInvalidReason;
}
