import { splitInlineThink } from "@/modules/chat/lib/streamPipeline";

describe("splitInlineThink", () => {
  it("passes plain content through untouched", () => {
    expect(splitInlineThink("just an answer")).toEqual({
      content: "just an answer",
      thinking: "",
    });
  });

  it("extracts a properly paired <think> block", () => {
    expect(splitInlineThink("<think>reasoning</think>answer")).toEqual({
      content: "answer",
      thinking: "reasoning",
    });
  });

  it("keeps visible content that surrounds a paired block", () => {
    expect(splitInlineThink("intro <think>why</think> tail")).toEqual({
      content: "intro  tail",
      thinking: "why",
    });
  });

  it("treats a closing tag with no opener as reasoning (kimi pattern)", () => {
    expect(splitInlineThink("reasoning</think>the answer")).toEqual({
      content: "the answer",
      thinking: "reasoning",
    });
  });

  it("merges reasoning across multiple unopened closes (multi-round)", () => {
    expect(
      splitInlineThink("first thought</think>second thought</think>answer"),
    ).toEqual({
      content: "answer",
      thinking: "first thoughtsecond thought",
    });
  });

  it("routes an unclosed trailing <think> entirely to reasoning (mid-stream)", () => {
    expect(splitInlineThink("<think>still going")).toEqual({
      content: "",
      thinking: "still going",
    });
  });

  it("hides a half-arrived tag at the streaming tail", () => {
    expect(splitInlineThink("<think>why</think>ans<thi")).toEqual({
      content: "ans",
      thinking: "why",
    });
  });
});
