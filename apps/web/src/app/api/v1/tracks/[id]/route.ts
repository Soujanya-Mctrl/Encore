import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { getAuthenticatedUser } from "@/server/request-context";
import { CatalogError } from "@encore/core";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return catalogResponse(async () => {
    const { id } = await params;
    const { repo } = catalog();
    const r = await repo.get(id);
    const u = await getAuthenticatedUser(_req);
    if (
      !r ||
      ((r.status !== "published" || r.paused) &&
        r.artistId !== u?.id &&
        !u?.roles.some((r) => ["admin", "reviewer"].includes(r)))
    )
      throw new CatalogError("Track not found", 404);
    const {audioPath,...publicTrack}=r;
    return { track: r.artistId===u?.id ? {...publicTrack,audioPath} : publicTrack, history: await repo.history(id) };
  });
}

import { ReleaseInputSchema } from "@encore/contracts";
import { requireAuthenticatedUser } from "@/server/request-context";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = guardSessionAuthWrite(req);
  if (denied) return denied;
  const auth = await requireAuthenticatedUser(["artist"], req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    const body = await req.json();
    const parsed = ReleaseInputSchema.pick({
      originCategory: true,
      contributions: true,
    }).safeParse(body.manifest);
    if (!parsed.success || !Number.isInteger(body.expectedVersion))
      throw new CatalogError("Invalid Passport revision");
    await catalog().service.revise(
      (await params).id,
      auth.user.id,
      parsed.data,
      body.expectedVersion,
    );
    return { ok: true };
  });
}
