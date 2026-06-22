// Stub for `expo-image-picker`. The real module shows a native picker UI
// which cannot run under Jest. By default the mock simulates a cancelled
// picker; individual tests can override the next call's outcome via
// `__setNextResult(...)` to exercise either the success or cancel path.

// Minimal local copies of the relevant types from `expo-image-picker`. We
// avoid importing the real package to keep the mock standalone and prevent
// circular resolution under jest's auto-mock heuristics.
export interface ImagePickerAsset {
  uri: string;
  width: number;
  height: number;
  type?: "image" | "video";
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string;
}

export type ImagePickerResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: ImagePickerAsset[] };

const cancelledResult: ImagePickerResult = { canceled: true, assets: null };
let nextResult: ImagePickerResult | null = null;

// Test helper: queue the result returned by the next `launchCameraAsync` or
// `launchImageLibraryAsync` call. Consumed (set back to null) after one read
// so subsequent calls fall back to the cancelled default.
export function __setNextResult(result: ImagePickerResult): void {
  nextResult = result;
}

// Test helper: clear any queued result. Useful in `beforeEach`.
export function __resetForTest(): void {
  nextResult = null;
}

function consumeNext(): ImagePickerResult {
  if (nextResult !== null) {
    const r = nextResult;
    nextResult = null;
    return r;
  }
  return cancelledResult;
}

export async function launchCameraAsync(): Promise<ImagePickerResult> {
  return consumeNext();
}

export async function launchImageLibraryAsync(): Promise<ImagePickerResult> {
  return consumeNext();
}

// Permission helpers — always granted in tests; override per-suite via
// `jest.spyOn` if a denied-permission branch needs coverage.
export async function requestCameraPermissionsAsync(): Promise<{
  granted: boolean;
  status: "granted";
}> {
  return { granted: true, status: "granted" };
}

export async function requestMediaLibraryPermissionsAsync(): Promise<{
  granted: boolean;
  status: "granted";
}> {
  return { granted: true, status: "granted" };
}

export enum MediaTypeOptions {
  All = "All",
  Images = "Images",
  Videos = "Videos",
}
