import { joinRecognisedLines, ocrPages } from "@/modules/chat/lib/pdfOcr";

describe("joinRecognisedLines", () => {
  // The recogniser returns one string per line; a table or a form only reads right if the breaks survive.
  it("keeps the line breaks and drops the blanks", () => {
    expect(joinRecognisedLines(["Amount due", "  ", " 45.04 EUR ", ""])).toBe(
      "Amount due\n45.04 EUR",
    );
  });

  it("returns nothing when nothing was recognised", () => {
    expect(joinRecognisedLines([])).toBe("");
    expect(joinRecognisedLines(["   "])).toBe("");
  });
});

describe("ocrPages", () => {
  // The Jest shim reports the recogniser as unavailable, which is also the real answer in Expo Go.
  it("recognises nothing where the platform cannot", async () => {
    await expect(
      ocrPages([
        { page: 1, uri: "file:///page1.png", width: 1447, height: 2046 },
      ]),
    ).resolves.toEqual([]);
  });

  it("asks for nothing when there are no pages", async () => {
    await expect(ocrPages([])).resolves.toEqual([]);
  });
});
