import { ProvenanceSubmissionSchema } from "@encore/contracts";
import { CatalogError } from "@encore/core";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { provenanceVerifier } from "@/server/provenance";
import { requireAuthenticatedUser } from "@/server/request-context";
import { requireStudioOwner } from "@/server/studio-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteContext) {
  const auth = await requireAuthenticatedUser(["artist"], req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    await requireStudioOwner(auth.user.id);
    const { service } = catalog();
    const release = await service.owned((await params).id, auth.user.id);
    const verifier = provenanceVerifier();
    return {
      mode: verifier.mode,
      expectedVersion: release.manifest.version,
      binding: verifier.issuerSetHash ? service.proofBinding(release, verifier.issuerSetHash) : null,
      result: release.manifest.provenance ?? null,
    };
  });
}

export async function POST(req: Request, { params }: RouteContext) {
  const denied = guardSessionAuthWrite(req);
  if (denied) return denied;
  const auth = await requireAuthenticatedUser(["artist"], req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    await requireStudioOwner(auth.user.id);
    const reader = req.body?.getReader();
    if (!reader) throw new CatalogError("Evidence request required");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new CatalogError("Evidence request is too large", 413);
      }
      chunks.push(value);
    }
    const parsed = ProvenanceSubmissionSchema.safeParse(
      await new Response(Buffer.concat(chunks)).json().catch(() => null)
    );
    if (!parsed.success) throw new CatalogError("Invalid evidence request");
    const track = await catalog().service.verifyProvenance(
      (await params).id, auth.user.id, parsed.data, provenanceVerifier()
    );
    return { manifest: track.manifest, manifestHash: track.manifestHash };
  });
}
