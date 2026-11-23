import { toOnDeviceTurns } from "@/modules/chat/api/onDeviceChat";

describe("toOnDeviceTurns", () => {
  it("keeps the conversation and drops what a local text model cannot use", () => {
    expect(
      toOnDeviceTurns([
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hi", images: ["aGVsbG8="] },
        { role: "assistant", content: "" },
        { role: "tool", content: "result", tool_name: "web_search" },
        { role: "assistant", content: "Hello!" },
      ]),
    ).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);
  });
});
