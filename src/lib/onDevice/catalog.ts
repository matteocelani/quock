// The Ollama builds each platform's engine runs, curated rather than scraped: one build per family and size, each
// measured first. Size and existence are verified live against the registry, and a build is offered only when the
// device can hold it.

import { Platform } from "react-native";

// MLX builds for Apple devices. Full-precision on purpose: the app quantizes them at install to 6-bit with an 8-bit
// head, which beat Ollama's mxfp8 builds on speed, memory and accuracy.
export const ON_DEVICE_CATALOG_APPLE: readonly string[] = [
  "qwen3.5:0.8b-mlx-bf16",
  "qwen3.5:2b-mlx-bf16",
  // Its 4.5 GB per-layer embedding table stays on flash, so this 5B-parameter model needs about 2 GB of memory.
  "gemma4:e2b-mlx-bf16",
];

// GGUF builds for llama.cpp on Android. Ollama's own quantizations, run as published: the default tag of each size.
export const ON_DEVICE_CATALOG_ANDROID: readonly string[] = [
  "qwen3.5:0.8b",
  "qwen3.5:2b",
  "qwen3.5:4b",
  "gemma4:e2b",
];

export const ON_DEVICE_CATALOG: readonly string[] =
  Platform.OS === "android"
    ? ON_DEVICE_CATALOG_ANDROID
    : ON_DEVICE_CATALOG_APPLE;
