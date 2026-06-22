import { beforeEach, describe, expect, it } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { useSettingsStore } from "@/lib/stores/settings.store";

describe("useHaptics", () => {
  // Settings store is module-singleton; resetting to the haptics default keeps each test independent.
  beforeEach(() => {
    useSettingsStore.setState({ hapticsEnabled: true });
  });

  it("returns stable no-throwing triggers when the preference is disabled", () => {
    useSettingsStore.setState({ hapticsEnabled: false });
    const { result } = renderHook(() => useHaptics());
    expect(typeof result.current.light).toBe("function");
    expect(typeof result.current.selection).toBe("function");
    expect(() => result.current.light()).not.toThrow();
  });
});
