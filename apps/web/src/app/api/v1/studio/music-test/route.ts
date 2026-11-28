import { MusicGenerationInputSchema } from "@encore/contracts";
import { ElevenLabsMusic, lyricSections, mp3Inspector, sha256 } from "@encore/infrastructure";
import { reviewLyrics } from "@encore/core";
import { requireAuthenticatedUser } from "@/server/request-context";
import { rejectCrossOriginRequest } from "@/server/request-security";
import { isLocalMusicTest } from "@/server/music-test-access";
import { rememberMusic } from "@/server/music-test-provenance";

export const runtime = "nodejs";
export const maxDuration = 210;

let used = false;

export async function POST(request: Request) {
  const denied = rejectCrossOriginRequest(request);
  if (denied) return denied;
  const apiKey = process.env.ELEVENLABS_MUSIC_API_KEY;
  const artistId = process.env.ENCORE_MUSIC_TEST_ARTIST_ID;
  const localOnly = isLocalMusicTest(request);
  if (!localOnly || artistId) {
    const auth = await requireAuthenticatedUser(["artist"]);
    if (auth.errorResponse) return auth.errorResponse;
    if (!artistId || auth.user.id !== artistId) {
      return Response.json({ error: "Music test access is disabled for this account." }, { status: 403 });
    }
  }
  if (!apiKey) {
    return Response.json({ error: "Music test access is disabled for this account." }, { status: 403 });
  }
  const input = MusicGenerationInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Check the prompt, settings and lyrics." }, { status: 400 });
  if (used) return Response.json({ error: "This server process has already used its one test request." }, { status: 429 });
  used = true;
  try {
    const music = new ElevenLabsMusic(apiKey);
    if (input.data.mode === "song") {
      const { bytes, words } = await music.generateWithLyrics(input.data);
      mp3Inspector.inspect(bytes);
      if (localOnly) await rememberMusic(bytes).catch(() => {});
      const result = new FormData();
      result.set("audio", new Blob([Uint8Array.from(bytes)], { type: "audio/mpeg" }), "take.mp3");
      result.set("review", JSON.stringify({
        audioHash: sha256.bytes(bytes),
        timestampsAvailable: words.length > 0,
        lines: reviewLyrics(lyricSections(input.data), words),
      }));
      return new Response(result, { headers: { "Cache-Control": "no-store" } });
    }
    const bytes = await music.generate(input.data);
    mp3Inspector.inspect(bytes);
    if (localOnly) await rememberMusic(bytes).catch(() => {});
    return new Response(Buffer.from(bytes), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Generation failed. Check ElevenLabs usage before retrying." }, { status: 502 });
  }
}
