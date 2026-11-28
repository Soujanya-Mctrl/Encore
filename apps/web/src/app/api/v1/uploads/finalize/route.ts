import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";
import { rejectCrossOriginRequest } from "@/server/request-security";
import { verifyUploadGrant } from "@/server/upload-grant";
import { ReleaseInputSchema } from "@encore/contracts";
import { CatalogError } from "@encore/core";
export async function POST(req: Request) {
  const denied = rejectCrossOriginRequest(req);
  if (denied) return denied;
  const auth = await requireAuthenticatedUser(["artist"]);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    const body = await req.json().catch(() => null),
      grant = verifyUploadGrant(body?.grant, auth.user.id),
      parsed = ReleaseInputSchema.safeParse(body?.metadata);
    if (!parsed.success)
      throw new CatalogError(
        "Complete metadata and confirm preview permission",
      );
    const { service, repo, storage } = catalog();
    const existing = await repo.get(grant.id);
    if (existing) {
      if (existing.artistId !== auth.user.id)
        throw new CatalogError("Not your upload", 403);
      return { track: existing };
    }
    const bytes = await storage.download(grant.path);
    try {
      const track = await service.upload(
        auth.user.id,
        parsed.data,
        bytes,
        grant.id,
      );
      await storage.remove(grant.path).catch(() => {});
      return { track };
    } catch (error) {
      if (error instanceof CatalogError && error.status === 400) await storage.remove(grant.path).catch(() => {});
      throw error;
    }
  });
}
