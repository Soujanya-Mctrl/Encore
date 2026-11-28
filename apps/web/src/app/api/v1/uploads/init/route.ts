import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";
import { rejectCrossOriginRequest } from "@/server/request-security";
import { uploadGrant } from "@/server/upload-grant";
import { MAX_AUDIO_BYTES } from "@encore/contracts";
export async function POST(req: Request) {
  const denied = rejectCrossOriginRequest(req);
  if (denied) return denied;
  const auth = await requireAuthenticatedUser(["artist"]);
  if (auth.errorResponse) return auth.errorResponse;
  const body = await req.json().catch(() => null);
  if (
    !Number.isInteger(body?.size) ||
    body.size <= 0 ||
    body.size > MAX_AUDIO_BYTES
  )
    return NextResponse.json(
      { error: "MP3 must be up to 20 MB" },
      { status: 400 },
    );
  return catalogResponse(async () => {
    const id = randomUUID(),
      path = `quarantine/${auth.user.id}/${id}.mp3`;
    return {
      url: await catalog().storage.grant(path),
      grant: uploadGrant(auth.user.id, id),
    };
  });
}
