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

describe("isOnDeviceModelName on Android", () => {
  afterEach(() => {
    jest.dontMock("react-native");
    jest.resetModules();
  });

  it("names GGUF builds by the curated list, since they carry no -mlx tag", () => {
    jest.resetModules();
    jest.doMock("react-native", () => {
      const actual = jest.requireActual("react-native");
      return Object.setPrototypeOf(
        { Platform: { ...actual.Platform, OS: "android" } },
        actual,
      );
    });
    const { isOnDeviceModelName: isLocal } = jest.requireActual(
      "@/lib/onDevice/onDeviceLLM",
    );
    expect(isLocal("qwen3.5:0.8b")).toBe(true);
    expect(isLocal("gemma4:e2b")).toBe(true);
    expect(isLocal("qwen3.5:397b")).toBe(false);
    expect(isLocal("glm-5.2")).toBe(false);
  });
});
