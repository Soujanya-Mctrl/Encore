import { NextResponse } from "next/server";
import { effectiveRights } from "@encore/core";
import { catalog } from "@/server/catalog";
import { getAuthenticatedUser } from "@/server/request-context";

const headers = { "Cache-Control": "private, no-store" };
const unavailable = () => NextResponse.json({ error: "Preview unavailable" }, { status: 404, headers });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { repo, storage, rights } = catalog();
    const track = await repo.get(id);
    if (!track || track.paused) return unavailable();
    const now = new Date();
    const record = (await rights.records([track])).get(id);
    const permitted = track.status === "published" && effectiveRights(record, now).preview;
    if (!permitted) {
      const user = await getAuthenticatedUser(req);
      if (track.status === "published" || !user ||
        (track.artistId !== user.id && !user.roles.some((role) => role === "reviewer" || role === "admin"))) {
        return unavailable();
      }
    }
    const ttl = permitted && record
      ? Math.min(60, Math.floor((Date.parse(record.declaration.validUntil) - Date.now()) / 1000))
      : 60;
    if (ttl < 1) return unavailable();
    const url = await storage.preview(track.audioPath, ttl);
    return new URL(req.url).searchParams.get("format") === "json"
      ? NextResponse.json({ url, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() }, { headers })
      : NextResponse.redirect(url, { status: 307, headers });
  } catch {
    return NextResponse.json({ error: "Playback temporarily unavailable" }, { status: 503, headers });
  }
}
