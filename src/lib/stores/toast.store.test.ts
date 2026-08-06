import { useToastStore } from "@/lib/stores/toast.store";

beforeEach(() => {
  jest.useFakeTimers();
  useToastStore.setState({ items: [] });
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const shown = (): { duration: number; tone: string } | undefined =>
  useToastStore.getState().items[0];

describe("toast duration", () => {
  // A failure names a file and often asks for a decision; three seconds is not enough to finish reading one.
  it("keeps an error on screen longer than a confirmation", () => {
    useToastStore.getState().show({ title: "ok" });
    const info = shown()?.duration ?? 0;
    useToastStore.getState().show({ title: "boom", tone: "error" });
    const error = shown()?.duration ?? 0;
    expect(error).toBeGreaterThan(info);
  });

  it("gives a warning the same room as an error", () => {
    useToastStore.getState().show({ title: "careful", tone: "warning" });
    const warning = shown()?.duration ?? 0;
    useToastStore.getState().show({ title: "boom", tone: "error" });
    expect(shown()?.duration).toBe(warning);
  });

  it("still lets a caller ask for its own duration", () => {
    useToastStore.getState().show({ title: "x", tone: "error", duration: 500 });
    expect(shown()?.duration).toBe(500);
  });
});
