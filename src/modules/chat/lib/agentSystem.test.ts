import { buildAgentSystemMessages } from "@/modules/chat/lib/agentSystem";
import type { DbMemory } from "@/lib/db/types";
import { asMemoryId } from "@/lib/types/ids";

function mem(id: number, content: string): DbMemory {
  return {
    id: asMemoryId(id),
    userId: "u1",
    content,
    createdAt: id,
    updatedAt: id,
    lastAccessedAt: id,
    source: "model",
  };
}

describe("buildAgentSystemMessages", () => {
  it("always returns a base contract block, even with no memories and no instructions", () => {
    const out = buildAgentSystemMessages([], null);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe("system");
    expect(out[0].content).toContain("agent mode");
    expect(out[0].content).not.toContain("[Agent instructions]");
    expect(out[0].content).not.toContain("[Memory]");
  });

  it("includes the user's custom instructions when set", () => {
    const out = buildAgentSystemMessages([], "Always answer in French");
    expect(out[0].content).toContain("[Agent instructions]");
    expect(out[0].content).toContain("Always answer in French");
  });

  it("emits one [Memory] line per memory, newest first", () => {
    const out = buildAgentSystemMessages(
      [mem(2, "Drone is a Meteor75 Pro"), mem(1, "Prefers short answers")],
      null,
    );
    expect(out[0].content).toContain("[Memory]\n- Drone is a Meteor75 Pro\n- Prefers short answers");
  });

  it("caps a long memory line so one over-long save cannot crowd out the rest", () => {
    const long = "x".repeat(500);
    const out = buildAgentSystemMessages([mem(1, long)], null);
    const section = out[0].content.split("[Memory]\n")[1];
    expect(section).toBeDefined();
    if (section === undefined) return;
    // 200 chars + the "- " prefix
    expect(section).toHaveLength(202);
    expect(section.startsWith("- x")).toBe(true);
  });

  it("trims and skips the instruction section when the text is blank", () => {
    const out = buildAgentSystemMessages([], "   ");
    expect(out[0].content).not.toContain("[Agent instructions]");
  });
});
