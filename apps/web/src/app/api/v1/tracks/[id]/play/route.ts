import { NextResponse } from "next/server";
import { catalog } from "@/server/catalog";
import { getAuthenticatedUser } from "@/server/request-context";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { repo, storage } = catalog();
    const r = await repo.get(id);
    const u = await getAuthenticatedUser();
    if (
      !r ||
      r.paused ||
      (r.manifest.rightsStatus !== "PREVIEW_ALLOWED" &&
        r.manifest.rightsStatus !== "COMMERCIAL_CLEARED") ||
      (r.status !== "published" &&
        r.artistId !== u?.id &&
        !u?.roles.some((role) => ["reviewer", "admin"].includes(role)))
    )
      return NextResponse.json(
        { error: "Preview unavailable" },
        { status: 404 },
      );
    return NextResponse.redirect(await storage.preview(r.audioPath), {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Playback temporarily unavailable" },
      { status: 503 },
    );
  }
}
