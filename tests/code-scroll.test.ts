import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { codeScrollBounds, thumbGeometry, translateForThumb } from "../src/reader/code-scroll.js";

describe("code peek scroll", () => {
  test("a short file has nowhere to peek", () => {
    const { minTop, maxTop } = codeScrollBounds(400, 800);
    assert.equal(minTop, maxTop);
    const g = thumbGeometry(800, 400, 800, maxTop);
    assert.equal(g.range, 0);
  });

  test("thumb position round-trips through the file", () => {
    const content = 4400;
    const vh = 800;
    const track = 780;
    const { minTop, maxTop } = codeScrollBounds(content, vh);
    for (const top of [maxTop, 0, -836, minTop]) {
      const g = thumbGeometry(track, content, vh, top);
      const back = translateForThumb(content, vh, g.thumbTop, g.thumbH, track);
      assert.ok(Math.abs(back - top) < 0.01, `${top} came back as ${back}`);
    }
  });

  test("the top of a long file parks the thumb at the start of the track", () => {
    const { maxTop } = codeScrollBounds(4400, 800);
    const g = thumbGeometry(780, 4400, 800, maxTop);
    assert.equal(g.thumbTop, 0);
  });
});
