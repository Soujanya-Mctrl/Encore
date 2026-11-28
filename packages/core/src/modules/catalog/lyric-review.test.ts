import { describe, expect, it } from "vitest";
import { reviewLyrics } from "./lyric-review.js";

describe("lyric review", () => {
  it("keeps line order, reports a variation, and seeks to the right word", () => {
    const words = "oh rain writes silver leave the light".split(" ").map((word, i) => ({ word, startMs: i * 200 }));
    const review = reviewLyrics([{ name: "Chorus", lyrics: "Rain writes silver\nLeave a little light\nCarry me home" }], words);
    expect(review).toMatchObject([
      { status: "match", startMs: 200 },
      { status: "variation", heard: "leave the light", startMs: 800 },
      { status: "uncertain" },
    ]);
  });

  it("reports uncertainty when the provider returns no word timestamps", () => {
    expect(reviewLyrics([{ name: "Verse", lyrics: "Carry me home" }], []))
      .toEqual([{ section: "Verse", expected: "Carry me home", status: "uncertain" }]);
  });
});
