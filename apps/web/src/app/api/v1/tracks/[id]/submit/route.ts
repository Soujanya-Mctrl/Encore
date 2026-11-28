import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { PassportVersionRequestSchema } from "@encore/contracts";
import { CatalogError } from "@encore/core";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rejected = guardSessionAuthWrite(req);
  if (rejected) return rejected;
  const auth = await requireAuthenticatedUser(["artist"], req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    const body = await req.json().catch(() => null);
    let expectedVersion: number | undefined;
    if (body?.expectedVersion !== undefined) {
      const parsed = PassportVersionRequestSchema.safeParse(body);
      if (!parsed.success) throw new CatalogError("Invalid Passport version");
      expectedVersion = parsed.data.expectedVersion;
    }
    await catalog().service.submit((await params).id, auth.user.id, expectedVersion);
    return { ok: true };
  });
}
