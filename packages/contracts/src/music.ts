import { z } from "zod";

const settings = {
  prompt: z.string().trim().min(1).max(500),
  durationSeconds: z.number().int().min(6).max(120),
  mood: z.string().trim().max(300).optional(),
  avoid: z.string().trim().max(300).optional(),
  bpm: z.number().int().min(40).max(240),
  key: z.enum(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]),
  scale: z.enum(["major", "minor"]),
};
const lyrics = z.string().trim().min(1).max(1000).refine(
  (value) => value.split(/\r?\n/).length <= 12 &&
    value.split(/\r?\n/).every((line) => line.length <= 200),
  "Use up to 12 lines of 200 characters per section",
);

const section = z.object({
  name: z.string().trim().min(1).max(40).regex(/^[^\r\n[\]{}]+$/),
  seconds: z.number().int().min(3).max(120),
  lyrics: z.union([z.literal(""), lyrics]),
  direction: z.string().trim().max(200),
}).strict();

export const MusicGenerationInputSchema = z.discriminatedUnion("mode", [
  z.object({ ...settings, mode: z.literal("beat") }).strict(),
  z.object({ ...settings, mode: z.literal("instrumental") }).strict(),
  z.object({
    ...settings, mode: z.literal("song"), verse: lyrics.optional(), chorus: lyrics.optional(),
    sections: z.array(section).min(1).max(12).optional(),
  }).strict(),
]).superRefine((input, context) => {
  if (input.mode !== "song") return;
  if (input.sections) {
    if (input.sections.reduce((total, item) => total + item.seconds, 0) !== input.durationSeconds ||
        !input.sections.some((item) => item.lyrics)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["sections"],
        message: "Match the total duration and add lyrics to at least one section" });
    }
  } else if (!input.verse || !input.chorus) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["verse"], message: "Enter verse and chorus lyrics" });
  }
});
export type MusicGenerationInput = z.infer<typeof MusicGenerationInputSchema>;

export const MusicGenerationEvidenceSchema = z.object({
  version: z.literal(1),
  provider: z.literal("elevenlabs"),
  model: z.literal("music_v2_5"),
  generationId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  audioHash: z.string().regex(/^[a-f0-9]{64}$/),
  providerReference: z.string().max(200).optional(),
}).strict();
export type MusicGenerationEvidence = z.infer<typeof MusicGenerationEvidenceSchema>;
