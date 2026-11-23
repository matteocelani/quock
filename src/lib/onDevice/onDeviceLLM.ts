// Runs Ollama's MLX builds on the phone itself. Optional on purpose: the native module ships for iOS devices only, so
// Android, the simulator and Jest see `isOnDeviceSupported() === false` and every call degrades to a no-op.

import { requireOptionalNativeModule } from "expo";

export interface OnDeviceModelInfo {
  model: string;
  bytes: number;
  capabilities: string[];
}

export interface OnDeviceStats {
  promptTokens: number;
  generatedTokens: number;
  tokensPerSecond: number;
  loadSeconds: number;
  peakMemoryBytes: number;
  events: number;
}

export interface OnDeviceTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PullProgress {
  model: string;
  completed: number;
  total: number;
}

export interface GenerateEvent {
  requestId: string;
  kind: "content" | "thinking";
  text: string;
}

interface Subscription {
  remove: () => void;
}

interface OnDeviceLLMModule {
  isSupported: () => boolean;
  listInstalled: () => OnDeviceModelInfo[];
  catalog: () => Promise<OnDeviceModelInfo[]>;
  pull: (model: string) => Promise<{ model: string; bytes: number }>;
  remove: (model: string) => Promise<void>;
  generate: (
    requestId: string,
    model: string,
    messages: OnDeviceTurn[],
    think: boolean | null,
    maxTokens: number,
  ) => Promise<OnDeviceStats>;
  cancel: (requestId: string) => Promise<void>;
  addListener(
    event: "onPullProgress",
    listener: (event: PullProgress) => void,
  ): Subscription;
  addListener(
    event: "onGenerateEvent",
    listener: (event: GenerateEvent) => void,
  ): Subscription;
}

const native = requireOptionalNativeModule<OnDeviceLLMModule>("OnDeviceLLM");

// Ollama names its MLX builds with a `-mlx` tag (`qwen3.5:0.8b-mlx`), and the cloud never serves one, so the tag alone
// tells which engine a stored model name belongs to — even before the installed list has loaded.
const ON_DEVICE_TAG = /:[^:]*-mlx$/;

export function isOnDeviceModelName(name: string): boolean {
  return ON_DEVICE_TAG.test(name);
}

export function isOnDeviceSupported(): boolean {
  return native?.isSupported() ?? false;
}

export function listInstalledOnDeviceModels(): OnDeviceModelInfo[] {
  return native?.listInstalled() ?? [];
}

export async function fetchOnDeviceCatalog(): Promise<OnDeviceModelInfo[]> {
  return native ? native.catalog() : [];
}

export async function pullOnDeviceModel(
  model: string,
  onProgress: (progress: PullProgress) => void,
): Promise<void> {
  if (!native) throw new Error("On-device models are not available here");
  const subscription = native.addListener("onPullProgress", (event) => {
    if (event.model === model) onProgress(event);
  });
  try {
    await native.pull(model);
  } finally {
    subscription.remove();
  }
}

export async function removeOnDeviceModel(model: string): Promise<void> {
  await native?.remove(model);
}

export function subscribeOnDeviceGeneration(
  requestId: string,
  listener: (event: GenerateEvent) => void,
): Subscription {
  if (!native) return { remove: (): void => undefined };
  return native.addListener("onGenerateEvent", (event) => {
    if (event.requestId === requestId) listener(event);
  });
}

export async function generateOnDevice(
  requestId: string,
  model: string,
  messages: OnDeviceTurn[],
  think: boolean | undefined,
  maxTokens: number,
): Promise<OnDeviceStats> {
  if (!native) throw new Error("On-device models are not available here");
  return native.generate(requestId, model, messages, think ?? null, maxTokens);
}

export async function cancelOnDeviceGeneration(
  requestId: string,
): Promise<void> {
  await native?.cancel(requestId);
}
