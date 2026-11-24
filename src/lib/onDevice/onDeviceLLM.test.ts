import {
  isOnDeviceModelName,
  prepareOnDeviceModel,
} from "@/lib/onDevice/onDeviceLLM";

describe("isOnDeviceModelName", () => {
  it("recognises Ollama's MLX builds by their tag", () => {
    expect(isOnDeviceModelName("qwen3.5:0.8b-mlx")).toBe(true);
    expect(isOnDeviceModelName("gemma4:e2b-mlx")).toBe(true);
    expect(isOnDeviceModelName("user/model:2b-mlx")).toBe(true);
    expect(isOnDeviceModelName("qwen3.5:0.8b-mlx-bf16")).toBe(true);
  });

  it("leaves cloud models and other builds to the cloud path", () => {
    expect(isOnDeviceModelName("glm-5.2")).toBe(false);
    expect(isOnDeviceModelName("qwen3-vl:235b-cloud")).toBe(false);
    expect(isOnDeviceModelName("qwen3.5:0.8b-nvfp4")).toBe(false);
    expect(isOnDeviceModelName("qwen3.5:0.8b-mlx-bf16-cloud")).toBe(false);
    expect(isOnDeviceModelName("mlx-model")).toBe(false);
  });
});

describe("prepareOnDeviceModel", () => {
  it("resolves false where the native module is absent", async () => {
    await expect(prepareOnDeviceModel("qwen3.5:2b-mlx-bf16")).resolves.toBe(
      false,
    );
  });
});
