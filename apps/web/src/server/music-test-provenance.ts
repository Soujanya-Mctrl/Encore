import "server-only";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { audioDigest, fingerprintAudio, fingerprintMatch } from "@encore/infrastructure";

const directory = join(tmpdir(), "encore-local-music-provenance");
type KnownAudio = { audioHash: string; pcmHash?: string; fingerprint?: number[] };

async function features(bytes: Uint8Array) {
  return fingerprintAudio(bytes).catch(() => null);
}

export async function rememberMusic(bytes: Uint8Array) {
  const audioHash = audioDigest(bytes);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${audioHash}.mp3`), bytes);
  await writeFile(join(directory, `${audioHash}.json`), JSON.stringify({
    audioHash, ...await features(bytes),
  }));
}

export async function matchKnownMusic(bytes: Uint8Array) {
  const hash = audioDigest(bytes);
  const files = (await readdir(directory).catch(() => [])).filter((name) => /^[a-f0-9]{64}\.json$/.test(name));
  if (files.includes(`${hash}.json`)) return { kind: "exact_file", referenceHash: hash };
  const decoded = await features(bytes);
  if (!decoded) return { kind: "decode_unavailable" };
  for (const file of files.slice(-100)) {
    const known: KnownAudio | null = await readFile(join(directory, file), "utf8").then(JSON.parse).catch(() => null);
    if (!known) continue;
    if (known.pcmHash === decoded.pcmHash) return { kind: "decoded_audio", referenceHash: known.audioHash };
    const match = known.fingerprint && fingerprintMatch(decoded.fingerprint, known.fingerprint);
    if (match) return { kind: "fingerprint_candidate", referenceHash: known.audioHash, ...match };
  }
  return { kind: "no_match" };
}

export async function checkMusicWatermark(audio: File) {
  const key = process.env.ELEVENLABS_PROVENANCE_API_KEY ?? process.env.ELEVENLABS_MUSIC_API_KEY;
  if (!key) return { status: "unavailable" };
  const form = new FormData();
  form.set("file", audio, "upload");
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/content-provenance/watermark", {
      method: "POST", headers: { "xi-api-key": key }, body: form, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return { status: "unavailable", httpStatus: response.status };
    const result = await response.json();
    if (result.is_detected === false) return { status: "not_detected" };
    if (result.is_detected !== true) return { status: "unavailable" };
    return { status: "detected", model: result.details?.model, product: result.details?.product };
  } catch {
    return { status: "unavailable" };
  }
}
