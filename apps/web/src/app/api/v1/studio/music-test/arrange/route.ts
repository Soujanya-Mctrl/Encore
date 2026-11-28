import { z } from "zod";
import { MusicGenerationInputSchema } from "@encore/contracts";
import { ElevenLabsMusic } from "@encore/infrastructure";
import { isLocalMusicTest } from "@/server/music-test-access";

const requestSchema = z.object({
  brief: z.string().trim().min(1).max(1500),
  seconds: z.number().int().min(6).max(120),
  current: MusicGenerationInputSchema.optional(),
});
const proposalSchema = z.object({
  chunks: z.array(z.object({
    text: z.string().max(6132),
    durationMs: z.number().int().min(3000).max(120000),
    positiveStyles: z.array(z.string()).max(50).default([]),
  })).min(1).max(12),
});

export async function POST(request: Request) {
  if (!isLocalMusicTest(request)) return Response.json({ error: "Local Studio only." }, { status: 403 });
  const key = process.env.ELEVENLABS_MUSIC_API_KEY;
  if (!key) return Response.json({ error: "Music key unavailable." }, { status: 403 });
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Check your brief and arrangement settings." }, { status: 400 });
  const { brief, seconds, current } = input.data;
  try {
    const source = current?.mode === "song" ? current : undefined;
    const raw = await new ElevenLabsMusic(key).proposeArrangement(
      `${brief}\nReturn a vocal-song arrangement with up to 12 named sections. Keep existing section names for sections with lyrics. Use a total of ${seconds} seconds.`,
      seconds, source,
    );
    const plan = proposalSchema.parse(raw);
    const sections = plan.chunks.map((chunk, index) => {
      const label = chunk.text.match(/^\[([^\]\r\n]+)\]/);
      return {
        name: (label?.[1]?.replace(/[{}\[\]]/g, "").trim().slice(0, 40) || `Section ${index + 1}`),
        seconds: Math.round(chunk.durationMs / 1000),
        lyrics: chunk.text.slice(label?.[0].length ?? 0).replace(/\{[^}]*\}/g, "").trim()
          .split(/\r?\n/).slice(0, 12).map((line) => line.slice(0, 200)).join("\n").slice(0, 1000),
        direction: chunk.positiveStyles.join(", ").slice(0, 200),
      };
    });
    const originals = source?.sections ?? [];
    if (originals.some((original) => original.lyrics &&
      (originals.filter((item) => item.name === original.name).length !== 1 ||
       sections.filter((item) => item.name.toLowerCase() === original.name.toLowerCase()).length !== 1))) {
      return Response.json({ error: "Proposal changed or removed a section with lyrics. Try a more specific request." }, { status: 422 });
    }
    if (sections.reduce((sum, section) => sum + section.seconds, 0) > 120) {
      return Response.json({ error: "Proposed arrangement exceeds 120 seconds." }, { status: 422 });
    }
    return Response.json({ sections: sections.map((section) => {
      const original = originals.find((item) => item.name.toLowerCase() === section.name.toLowerCase());
      return { ...section, lyrics: source ? original?.lyrics ?? "" : section.lyrics };
    }) });
  } catch {
    return Response.json({ error: "ElevenLabs could not return an editable arrangement." }, { status: 502 });
  }
}
