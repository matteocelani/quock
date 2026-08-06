// Image upload helpers: the heavy decode/resize/re-encode + native byte read are kept OFF the attach path (chips
// paint instantly) and run lazily at send time via materializeImageAttachment, so a mid-attach remove never waits.

import { File } from "expo-file-system";
import {
  manipulateAsync,
  SaveFormat,
  type ActionResize,
} from "expo-image-manipulator";
import type { UiAttachment } from "@/modules/chat/types";
import { isImageMime } from "@/modules/chat/lib/documentText";
import {
  IMAGE_MAX_UPLOAD_DIMENSION,
  IMAGE_UPLOAD_COMPRESS,
} from "@/modules/chat/constants";

// A temp file that has served its purpose. Failing to delete it costs cache space, never the send.
export async function deleteFileQuietly(uri: string): Promise<void> {
  try {
    new File(uri).delete();
  } catch (err) {
    console.warn("imageUpload: could not delete a temporary file", err);
  }
}

// Read file bytes NATIVELY via expo-file-system's File.bytes() to keep large multi-MB reads off the JS thread.
export async function readUriAsBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

// Long-edge resize to IMAGE_MAX_UPLOAD_DIMENSION, or no op at all when the image already fits (never upscale). Pure and
// separate from the native call so the sizing rule is testable, and so a caller can re-encode without resizing.
export function resizeOpsFor(width: number, height: number): ActionResize[] {
  if (Math.max(width, height) <= IMAGE_MAX_UPLOAD_DIMENSION) return [];
  const resize =
    width >= height
      ? { width: IMAGE_MAX_UPLOAD_DIMENSION }
      : { height: IMAGE_MAX_UPLOAD_DIMENSION };
  return [{ resize }];
}

// Shrink an oversized photo to IMAGE_MAX_UPLOAD_DIMENSION on its long edge (JPEG recompress) before upload —
// full-resolution images stall the cloud vision model. Small photos pass through untouched (never upscale).
export async function downscaleImageUri(
  uri: string,
  width: number | undefined,
  height: number | undefined,
): Promise<string> {
  if (!width || !height) return uri;
  const ops = resizeOpsFor(width, height);
  if (ops.length === 0) return uri;
  const result = await manipulateAsync(uri, ops, {
    compress: IMAGE_UPLOAD_COMPRESS,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

// Re-encode to JPEG unconditionally, resizing only if oversized. For a source that is NOT already JPEG (a rendered PDF
// page is PNG on both platforms), the pass-through above would leave PNG bytes under an image/jpeg label.
export async function toJpegUri(
  uri: string,
  width: number,
  height: number,
): Promise<string> {
  const result = await manipulateAsync(uri, resizeOpsFor(width, height), {
    compress: IMAGE_UPLOAD_COMPRESS,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

// Produce the upload bytes at send time for an optimistically-attached image (data still undefined): run the
// deferred downscale + native byte read now. Non-images and already-materialized attachments pass through untouched.
export async function materializeImageAttachment(
  att: UiAttachment,
): Promise<UiAttachment> {
  if (att.data !== undefined || !isImageMime(att.mimeType)) return att;
  const uri = await downscaleImageUri(
    att.uri,
    att.originalWidth,
    att.originalHeight,
  );
  const data = await readUriAsBytes(uri);
  return { ...att, uri, data, sizeBytes: data.byteLength };
}
