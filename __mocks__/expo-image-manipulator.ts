// Stub for `expo-image-manipulator` — the real module runs native image ops that can't execute under Jest.
// AttachSheet (its only consumer) is covered by Maestro E2E, not Jest, so this just keeps any transitive import resolvable.

export const SaveFormat = {
  JPEG: "jpeg",
  PNG: "png",
  WEBP: "webp",
} as const;

export interface ImageResult {
  uri: string;
  width: number;
  height: number;
}

// No-op resize: echo the input uri back so callers get a valid result shape.
export async function manipulateAsync(uri: string): Promise<ImageResult> {
  return { uri, width: 0, height: 0 };
}
