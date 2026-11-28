import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { MusicGenerationInput } from "@encore/contracts";
import { z } from "zod";

export const MUSIC_MODEL = "music_v2_5";
const MAX_GENERATED_BYTES = 8 * 1024 * 1024;
const detailedMetadata = z.object({
  wordsTimestamps: z.array(z.object({
    word: z.string().max(200),
    startMs: z.number().finite().nonnegative(),
  })).max(3000).optional(),
});

export function lyricSections(input: Extract<MusicGenerationInput, { mode: "song" }>) {
  return input.sections ?? [
    { name: "Verse", seconds: input.durationSeconds / 2, lyrics: input.verse ?? "", direction: "" },
    { name: "Chorus", seconds: input.durationSeconds / 2, lyrics: input.chorus ?? "", direction: "" },
  ];
}

export function musicRequest(input: MusicGenerationInput) {
  const tempo = `${input.bpm} BPM`;
  const key = `${input.key} ${input.scale}`;
  const durationMs = input.durationSeconds * 1000;
  if (input.mode !== "song") {
    const arrangement = input.mode === "beat" ? "Percussion-focused beat" : "Full instrumental arrangement";
    return {
      modelId: MUSIC_MODEL,
      prompt: [arrangement, input.prompt, `Target ${tempo}, in ${key}`,
        input.mood && `Mood: ${input.mood}`, input.avoid && `Avoid: ${input.avoid}`].filter(Boolean).join(". "),
      musicLengthMs: durationMs,
      forceInstrumental: true,
    } as const;
  }
  const positiveStyles = [input.prompt, tempo, key, "clear lead vocals", ...(input.mood ? [input.mood] : [])];
  const sections = lyricSections(input);
  return {
    modelId: MUSIC_MODEL as typeof MUSIC_MODEL,
    compositionPlan: {
      chunks: sections.map((section) => ({
        text: `[${section.name}]\n${section.lyrics || "{instrumental}"}`,
        durationMs: section.seconds * 1000,
        positiveStyles: section.direction ? [...positiveStyles, section.direction] : positiveStyles,
        negativeStyles: input.avoid ? [input.avoid] : [],
        contextAdherence: "high" as const,
      })),
    },
  };
}

export class ElevenLabsMusic {
  private readonly client: ElevenLabsClient;

  constructor(apiKey: string) {
    this.client = new ElevenLabsClient({ apiKey });
  }

  async proposeArrangement(prompt: string, seconds: number, current?: Extract<MusicGenerationInput, { mode: "song" }>) {
    const request = current ? musicRequest(current) : undefined;
    return this.client.music.compositionPlan.create({
      prompt, musicLengthMs: seconds * 1000, modelId: MUSIC_MODEL,
      ...(request?.compositionPlan && { sourceCompositionPlan: request.compositionPlan }),
    }, { maxRetries: 0, timeoutInSeconds: 35 });
  }

  async generateWithLyrics(input: Extract<MusicGenerationInput, { mode: "song" }>) {
    const response: unknown = await this.client.music.composeDetailed(
      { ...musicRequest(input), withTimestamps: true },
      { maxRetries: 0, timeoutInSeconds: 180 },
    );
    // The SDK's installed wrapper returns multipart data, while its public type describes a stream.
    if (!response || typeof response !== "object" || !("audio" in response) ||
        !(response.audio instanceof Uint8Array) || response.audio.byteLength > MAX_GENERATED_BYTES) {
      throw new Error("Invalid detailed music response");
    }
    const metadata = detailedMetadata.safeParse("json" in response ? response.json : null);
    return { bytes: response.audio, words: metadata.success ? metadata.data.wordsTimestamps ?? [] : [] };
  }

  async generate(input: MusicGenerationInput): Promise<Uint8Array> {
    const audio = await this.client.music.compose(musicRequest(input), {
      maxRetries: 0,
      timeoutInSeconds: 180,
    });
    const reader = audio.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_GENERATED_BYTES) {
          await reader.cancel();
          throw new Error("Generated audio exceeds the size limit");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks, size);
  }
}
