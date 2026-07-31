import { resizeOpsFor } from "@/modules/chat/lib/imageUpload";
import { IMAGE_MAX_UPLOAD_DIMENSION } from "@/modules/chat/constants";

const CAP = IMAGE_MAX_UPLOAD_DIMENSION;

describe("resizeOpsFor", () => {
  it("returns no op for an image already within the cap", () => {
    expect(resizeOpsFor(CAP, CAP - 1)).toEqual([]);
  });

  it("constrains the width of a landscape image", () => {
    expect(resizeOpsFor(CAP * 2, CAP)).toEqual([{ resize: { width: CAP } }]);
  });

  it("constrains the height of a portrait image", () => {
    expect(resizeOpsFor(CAP, CAP * 2)).toEqual([{ resize: { height: CAP } }]);
  });

  // A square over the cap has no long edge; pinning width keeps the aspect ratio either way.
  it("constrains the width of an oversized square", () => {
    expect(resizeOpsFor(CAP + 1, CAP + 1)).toEqual([
      { resize: { width: CAP } },
    ]);
  });
});
