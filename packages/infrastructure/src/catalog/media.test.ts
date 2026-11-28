import { describe, it, expect } from "vitest";
import { canonicalize, sha256, mp3Inspector } from "./media";
describe("Passport integrity and media validation", () => {
  it("canonicalizes nested keys independently of input insertion order", () => {
    const a = { z: 1, a: { b: 2, a: "é" } },
      b = { a: { a: "é", b: 2 }, z: 1 };
    expect(canonicalize(a)).toBe('{"a":{"a":"é","b":2},"z":1}');
    expect(sha256.hash(a)).toBe(sha256.hash(b));
    expect(sha256.hash(a)).not.toBe(sha256.hash({ ...a, z: 2 }));
  });
  it("rejects fake MP3s, ID3-only files, oversized data and truncated frames", () => {
    for (const bytes of [
      new TextEncoder().encode("not music"),
      new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]),
      new Uint8Array(21 * 1024 * 1024),
      new Uint8Array([255, 251, 144, 0]),
    ])
      expect(() => mp3Inspector.inspect(bytes)).toThrow();
  });
  it("parses frame lengths and duration rather than trusting MIME", () => {
    const frames = new Uint8Array(417 * 4);
    for (let i = 0; i < 4; i++) frames.set([255, 251, 144, 0], 417 * i);
    expect(mp3Inspector.inspect(frames).durationSeconds).toBeCloseTo(
      (4 * 1152) / 44100,
      3,
    );
    expect(() =>
      mp3Inspector.inspect(frames.subarray(0, frames.length - 1)),
    ).toThrow();
  });
});
