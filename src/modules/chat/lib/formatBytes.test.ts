import { formatBytes } from "@/modules/chat/lib/formatBytes";

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

describe("formatBytes", () => {
  it("renders a dash for empty or non-positive sizes", () => {
    expect(formatBytes(0)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
  });

  it("renders raw bytes below 1 KB", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(KB - 1)).toBe("1023 B");
  });

  it("rounds to whole KB between 1 KB and 1 MB", () => {
    expect(formatBytes(KB)).toBe("1 KB");
    expect(formatBytes(47 * KB)).toBe("47 KB");
    // 1.5 KB rounds up to 2 KB.
    expect(formatBytes(Math.round(1.5 * KB))).toBe("2 KB");
  });

  it("renders one decimal of MB between 1 MB and 1 GB", () => {
    expect(formatBytes(MB)).toBe("1.0 MB");
    expect(formatBytes(Math.round(1.2 * MB))).toBe("1.2 MB");
  });

  it("renders two decimals of GB at or above 1 GB", () => {
    expect(formatBytes(GB)).toBe("1.00 GB");
    expect(formatBytes(Math.round(1.5 * GB))).toBe("1.50 GB");
  });
});
