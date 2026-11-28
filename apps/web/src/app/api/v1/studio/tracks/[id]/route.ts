import { StudioDraftEditSchema } from "@encore/contracts";
import { CatalogError } from "@encore/core";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";
import { requireStudioOwner } from "@/server/studio-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteContext) {
  const auth = await requireAuthenticatedUser(["artist"], req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    await requireStudioOwner(auth.user.id);
    const { id } = await params;
    const { repo, service } = catalog();
    const { audioPath, ...track } = await service.owned(id, auth.user.id);
    return { track, history: await repo.history(id) };
  });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const denied = guardSessionAuthWrite(req);
  if (denied) return denied;
  const auth = await requireAuthenticatedUser(["artist"], req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    await requireStudioOwner(auth.user.id);
    const { id } = await params;
    const parsed = StudioDraftEditSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new CatalogError("Invalid draft metadata or revision");
    const { service } = catalog();
    await service.revise(id, auth.user.id, parsed.data.metadata, parsed.data.expectedVersion);
    return { ok: true };
  });
}
