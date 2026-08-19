import { splitInlineThink } from "@/modules/chat/lib/streamPipeline";

// `isThinking` is asserted on every shape, not just the obvious ones: it drives the shimmer that tells a long wait
// apart from a freeze, and the only honest answer to "is it thinking" is whether the buffer ends inside a think span.
describe("splitInlineThink", () => {
  it("passes plain content through untouched", () => {
    expect(splitInlineThink("just an answer")).toEqual({
      content: "just an answer",
      thinking: "",
      isThinking: false,
    });
  });

  it("extracts a properly paired <think> block", () => {
    expect(splitInlineThink("<think>reasoning</think>answer")).toEqual({
      content: "answer",
      thinking: "reasoning",
      isThinking: false,
    });
  });

  it("keeps visible content that surrounds a paired block", () => {
    expect(splitInlineThink("intro <think>why</think> tail")).toEqual({
      content: "intro  tail",
      thinking: "why",
      isThinking: false,
    });
  });

  it("treats a closing tag with no opener as reasoning (kimi pattern)", () => {
    expect(splitInlineThink("reasoning</think>the answer")).toEqual({
      content: "the answer",
      thinking: "reasoning",
      isThinking: false,
    });
  });

  it("merges reasoning across multiple unopened closes (multi-round)", () => {
    expect(
      splitInlineThink("first thought</think>second thought</think>answer"),
    ).toEqual({
      content: "answer",
      thinking: "first thoughtsecond thought",
      isThinking: false,
    });
  });

  it("routes an unclosed trailing <think> entirely to reasoning (mid-stream)", () => {
    expect(splitInlineThink("<think>still going")).toEqual({
      content: "",
      thinking: "still going",
      isThinking: true,
    });
  });

  it("hides a half-arrived tag at the streaming tail", () => {
    expect(splitInlineThink("<think>why</think>ans<thi")).toEqual({
      content: "ans",
      thinking: "why",
      isThinking: false,
    });
  });

  // The answer shrinks here — "shown" text is reclassified as thought — while the model is writing `X` in the same
  // delta. Any rule based on comparing answer lengths reads this backwards.
  it("reports writing when a bare close is followed by fresh content", () => {
    expect(splitInlineThink("ABCDE</think>X")).toEqual({
      content: "X",
      thinking: "ABCDE",
      isThinking: false,
    });
  });
});
