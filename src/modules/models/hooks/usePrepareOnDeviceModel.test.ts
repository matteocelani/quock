import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import { usePrepareOnDeviceModel } from "@/modules/models/hooks/usePrepareOnDeviceModel";

const mockPrepare = jest.fn<(model: string) => Promise<boolean>>();

jest.mock("@/lib/onDevice/onDeviceLLM", () => ({
  prepareOnDeviceModel: (model: string): Promise<boolean> => mockPrepare(model),
}));

describe("usePrepareOnDeviceModel", () => {
  beforeEach(() => {
    mockPrepare.mockReset();
    mockPrepare.mockResolvedValue(true);
  });

  it("prepares the chat's model once per model name", () => {
    const { rerender } = renderHook(
      ({ name }: { name: string | undefined }) => usePrepareOnDeviceModel(name),
      { initialProps: { name: "qwen3.5:2b-mlx-bf16" } },
    );
    rerender({ name: "qwen3.5:2b-mlx-bf16" });
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    rerender({ name: "gemma4:e2b-mlx-bf16" });
    expect(mockPrepare).toHaveBeenLastCalledWith("gemma4:e2b-mlx-bf16");
  });

  it("does nothing without a model and swallows a failed prepare", async () => {
    renderHook(() => usePrepareOnDeviceModel(undefined));
    expect(mockPrepare).not.toHaveBeenCalled();
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    mockPrepare.mockRejectedValueOnce(new Error("not enough memory"));
    renderHook(() => usePrepareOnDeviceModel("qwen3.5:0.8b-mlx-bf16"));
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
