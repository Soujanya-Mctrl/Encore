import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

export function audioDigest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function decode(bytes: Uint8Array, output: string[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin",
      "-protocol_whitelist", "pipe", "-i", "pipe:0", "-vn", "-t", "120", ...output, "pipe:1"],
    { stdio: ["pipe", "pipe", "ignore"], windowsHide: true, timeout: 15000 });
    const parts: Buffer[] = [];
    let length = 0;
    child.stdout.on("data", (part: Buffer) => {
      length += part.length;
      if (length > 6_000_000) child.kill();
      else parts.push(part);
    });
    child.stdin.on("error", () => {});
    child.on("error", reject);
    child.on("close", (code) => code === 0 && length > 0 && length <= 6_000_000
      ? resolve(Buffer.concat(parts)) : reject(new Error("Audio decoding failed")));
    child.stdin.end(bytes);
  });
}

export async function fingerprintAudio(bytes: Uint8Array) {
  const [pcm, fp] = await Promise.all([
    decode(bytes, ["-ac", "1", "-ar", "11025", "-f", "s16le"]),
    decode(bytes, ["-f", "chromaprint", "-fp_format", "raw"]).catch(() => Buffer.alloc(0)),
  ]);
  return {
    pcmHash: audioDigest(pcm),
    fingerprint: Array.from({ length: Math.floor(fp.length / 4) }, (_, index) => fp.readUInt32LE(index * 4)),
  };
}

function differingBits(a: number, b: number) {
  let bits = (a ^ b) >>> 0;
  let count = 0;
  while (bits) {
    bits = (bits & (bits - 1)) >>> 0;
    count++;
  }
  return count;
}

export function fingerprintMatch(upload: number[], original: number[]) {
  let best: { similarity: number; comparedSeconds: number; uploadOffsetSeconds: number } | undefined;
  // Roughly ten seconds of overlapping Chromaprint frames, with at least
  // half the shorter track covered. This is a conservative review heuristic.
  const minimum = Math.max(80, Math.ceil(Math.min(upload.length, original.length) / 2));
  for (let offset = minimum - original.length; offset <= upload.length - minimum; offset++) {
    const first = Math.max(0, offset);
    const last = Math.min(upload.length, original.length + offset);
    let distance = 0;
    for (let i = first; i < last; i++) distance += differingBits(upload[i]!, original[i - offset]!);
    const similarity = 1 - distance / (32 * (last - first));
    if (similarity >= 0.9 && (!best || similarity > best.similarity)) {
      best = { similarity, comparedSeconds: Math.round((last - first) * 0.124),
        uploadOffsetSeconds: Math.round(first * 0.124) };
    }
  }
  return best;
}
