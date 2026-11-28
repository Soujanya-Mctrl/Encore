import { createHash } from "node:crypto";
import type { DigestPort, AudioInspectorPort } from "@encore/core";
import { CatalogError } from "@encore/core";
import { MAX_AUDIO_BYTES } from "@encore/contracts";
// JSON-compatible manifests contain no floating-point/undefined values. Sorted UTF-16 keys follow JCS.
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object" && value) {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  }
  throw new CatalogError("Manifest contains unsupported values");
}
export const sha256: DigestPort = {
  hash: (value) =>
    createHash("sha256").update(canonicalize(value)).digest("hex"),
  bytes: (value) => createHash("sha256").update(value).digest("hex"),
};
// Parse every MPEG Layer III frame. A filename, MIME type, or ID3 tag alone never validates audio.
export const mp3Inspector: AudioInspectorPort = {
  inspect(bytes) {
    if (!bytes.length || bytes.length > MAX_AUDIO_BYTES)
      throw new CatalogError("MP3 must be between 1 byte and 20 MB");
    let offset = 0,
      frames = 0,
      seconds = 0;
    let metadataSignal: "ai_metadata_signal" | undefined;
    if (bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) {
      if (bytes.length < 10 || [6, 7, 8, 9].some((i) => bytes[i]! > 127))
        throw new CatalogError("Invalid ID3 header");
      offset =
        10 +
        ((bytes[6]! << 21) | (bytes[7]! << 14) | (bytes[8]! << 7) | bytes[9]!);
      const tagText = new TextDecoder("latin1").decode(bytes.subarray(10, Math.min(offset, 65546)));
      if (/\b(?:generated (?:by|with) (?:suno|udio|elevenlabs|ai)|ai[-_ ]generated|synthetic[-_ ]audio)\b/i.test(tagText.replaceAll("\0", ""))) {
        metadataSignal = "ai_metadata_signal";
      }
      if (bytes[5]! & 16) offset += 10;
    }
    while (offset + 4 <= bytes.length) {
      if (
        bytes.length - offset === 128 &&
        bytes[offset] === 84 &&
        bytes[offset + 1] === 65 &&
        bytes[offset + 2] === 71
      ) {
        offset += 128;
        break;
      }
      const a = bytes[offset]!,
        b = bytes[offset + 1]!,
        c = bytes[offset + 2]!;
      const ver = (b >> 3) & 3,
        layer = (b >> 1) & 3,
        rateIndex = (c >> 2) & 3,
        bitrateIndex = c >> 4;
      if (
        a !== 255 ||
        (b & 224) !== 224 ||
        ver === 1 ||
        layer !== 1 ||
        rateIndex === 3 ||
        bitrateIndex === 0 ||
        bitrateIndex === 15
      )
        throw new CatalogError("Upload must contain valid MP3 audio frames");
      const rates = [44100, 48000, 32000];
      const rate = rates[rateIndex]! / (ver === 3 ? 1 : ver === 2 ? 2 : 4);
      const bitrate =
        (ver === 3
          ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
          : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[
          bitrateIndex
        ]! * 1000;
      const length =
        Math.floor(((ver === 3 ? 144 : 72) * bitrate) / rate) + ((c >> 1) & 1);
      if (offset + length > bytes.length)
        throw new CatalogError("Truncated MP3 frame");
      offset += length;
      frames++;
      seconds += (ver === 3 ? 1152 : 576) / rate;
    }
    if (frames < 3 || offset !== bytes.length || seconds > 900)
      throw new CatalogError(
        "Provide a complete MP3 preview of up to 15 minutes",
      );
    return { durationSeconds: Math.round(seconds * 1000) / 1000, ...(metadataSignal ? { metadataSignal } : {}) };
  },
};
