import { isLocalMusicTest } from "@/server/music-test-access";
import { checkMusicWatermark, matchKnownMusic } from "@/server/music-test-provenance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isLocalMusicTest(request)) return Response.json({ error: "Local Studio only." }, { status: 403 });
  const length = Number(request.headers.get("content-length"));
  if (!length || length > 8_010_000) return Response.json({ error: "Upload an audio file up to 8 MB." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || !audio.size || audio.size > 8_000_000 || !audio.type.startsWith("audio/")) {
    return Response.json({ error: "Upload an audio file up to 8 MB." }, { status: 400 });
  }
  const local = await matchKnownMusic(new Uint8Array(await audio.arrayBuffer()));
  const watermark = form?.get("consent") === "yes" ? await checkMusicWatermark(audio) : { status: "not_requested" };
  return Response.json({ local, watermark }, { headers: { "Cache-Control": "no-store" } });
}
