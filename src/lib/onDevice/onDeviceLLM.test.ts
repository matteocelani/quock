import { isOnDeviceModelName } from "@/lib/onDevice/onDeviceLLM";

describe("isOnDeviceModelName", () => {
  it("recognises Ollama's MLX builds by their tag", () => {
    expect(isOnDeviceModelName("qwen3.5:0.8b-mlx")).toBe(true);
    expect(isOnDeviceModelName("gemma4:e2b-mlx")).toBe(true);
    expect(isOnDeviceModelName("user/model:2b-mlx")).toBe(true);
  });

  it("leaves cloud models and other builds to the cloud path", () => {
    expect(isOnDeviceModelName("glm-5.2")).toBe(false);
    expect(isOnDeviceModelName("qwen3-vl:235b-cloud")).toBe(false);
    expect(isOnDeviceModelName("qwen3.5:0.8b-mlx-bf16")).toBe(false);
    expect(isOnDeviceModelName("mlx-model")).toBe(false);
  });
});
