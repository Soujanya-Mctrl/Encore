import { PassportVersionRequestSchema } from "@encore/contracts";
import { CatalogError } from "@encore/core";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";
import { requireStudioOwner } from "@/server/studio-auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guardSessionAuthWrite(req);
  if (denied) return denied;
  const auth = await requireAuthenticatedUser(["artist"], req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    await requireStudioOwner(auth.user.id);
    const { id } = await params;
    const parsed = PassportVersionRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new CatalogError("Invalid Passport version");
    const { service, repo } = catalog();
    await service.owned(id, auth.user.id);
    await repo.delist(id, auth.user.id, parsed.data.expectedVersion);
    return { ok: true };
  });
}
