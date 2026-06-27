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
  // Upload bytes. OPTIONAL for optimistically-attached images (the downscale + byte read defers to send time);
  // text docs read their bytes at attach for inlining, so they always carry `data`.
  data?: Uint8Array;
  uri: string;
  mimeType?: string;
  // For optimistically-attached images this is the picker's fileSize estimate (or 0 when absent) so the
  // too-large warning still works pre-materialize; it's overwritten with the real downscaled length at send.
  sizeBytes: number;
  // Original picked pixel dimensions, kept so the deferred send-time downscale can size the long-edge resize.
  originalWidth?: number;
  originalHeight?: number;
  status: UiAttachmentStatus;
  invalidReason?: UiAttachmentInvalidReason;
}
