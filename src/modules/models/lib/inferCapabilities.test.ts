import { inferCapabilities } from "@/modules/models/lib/inferCapabilities";

describe("inferCapabilities", () => {
  it("seeds with `completion` and adds `tools` for qwen-2.5 family", () => {
    // Every text model on Ollama Cloud carries `completion` (verified via /api/show), so the heuristic mirrors that by including it unconditionally.
    expect(inferCapabilities("qwen-2.5:72b-cloud")).toEqual([
      "completion",
      "tools",
    ]);
  });

  it("returns just `completion` when the name matches no recognized flag", () => {
    expect(inferCapabilities("mystery-model-cloud")).toEqual(["completion"]);
  });

  it("adds `vision` for names matching known vision aliases without re-introducing `general`", () => {
    const chips = inferCapabilities("llama-3.2-vision-cloud");
    expect(chips).toContain("vision");
    expect(chips).not.toContain("general");
  });

  it("adds `tools` for known tool-capable model families", () => {
    expect(inferCapabilities("gpt-oss:120b-cloud")).toEqual(
      expect.arrayContaining(["tools"]),
    );
  });

  // The three cases below are pinned against what /api/show actually answers for the cloud catalogue: a wrong
  // guess here either ships images to a blind model or blocks them on a model that sees fine.
  it("does not claim vision for gpt-oss:120b, which /api/show reports as text-only", () => {
    expect(inferCapabilities("gpt-oss:120b")).not.toContain("vision");
  });

  it("gives the newest Kimi models both vision and thinking", () => {
    for (const name of ["kimi-k2.7-code", "kimi-k3"]) {
      expect(inferCapabilities(name)).toEqual(
        expect.arrayContaining(["vision", "thinking"]),
      );
    }
  });

  it("gives mistral-large-3 vision but withholds thinking, which it lacks", () => {
    const chips = inferCapabilities("mistral-large-3:675b");
    expect(chips).toContain("vision");
    expect(chips).not.toContain("thinking");
  });

  it("filters out the `general` baseline when the server provides one", () => {
    const chips = inferCapabilities("anything", ["general", "vision"]);
    expect(chips).toEqual(["vision"]);
  });

  it("returns an empty array when the server only emits the baseline", () => {
    expect(inferCapabilities("anything", ["general"])).toEqual([]);
  });

  it("trusts an explicit non-baseline capability list verbatim", () => {
    const chips = inferCapabilities("anything", ["tools", "vision"]);
    expect(chips).toEqual(["tools", "vision"]);
  });
});
