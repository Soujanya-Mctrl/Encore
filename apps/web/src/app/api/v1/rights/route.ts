import { RightsActionSchema } from "@encore/contracts";
import { CatalogError, reviewRights } from "@encore/core";
import { sha256 } from "@encore/infrastructure";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { catalog } from "@/server/catalog";
import { catalogResponse } from "@/server/catalog-http";
import { requireAuthenticatedUser } from "@/server/request-context";

const isReviewer = (roles: readonly string[]) => roles.includes("reviewer") || roles.includes("admin");

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    const { rights, repo } = catalog();
    const query = new URL(req.url).searchParams;
    const trackId = query.get("trackId");
    if (trackId) {
      const track = await repo.get(trackId);
      if (!track || (track.artistId !== auth.user.id && !await rights.canReview(auth.user.id, track.id))) {
        throw new CatalogError("Rights file not found", 404);
      }
      return { records: [...(await rights.records([track])).values()], inquiries: [] };
    }
    const tracks = await repo.mine(auth.user.id);
    const records = query.has("review") && isReviewer(auth.user.roles)
      ? await rights.reviewQueue(auth.user.id) : [...(await rights.records(tracks)).values()];
    return { records, inquiries: await rights.inbox(auth.user.id, tracks) };
  });
}

export async function POST(req: Request) {
  const blocked = guardSessionAuthWrite(req);
  if (blocked) return blocked;
  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    const parsed = RightsActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new CatalogError("Invalid rights action");
    const action = parsed.data;
    const { rights, repo } = catalog();
    if (action.action === "review") {
      if (!isReviewer(auth.user.roles)) throw new CatalogError("Reviewer role required", 403);
      const track = await repo.get(action.trackId);
      if (!track || !await rights.canReview(auth.user.id, track.id)) throw new CatalogError("Independent reviewer assignment required", 403);
      const record = (await rights.records([track])).get(track.id);
      if (!record || record.revision !== action.revision || record.passport_version !== action.version) {
        throw new CatalogError("Rights declaration changed", 409);
      }
      const aiSignal = track.manifest.metadataSignal === "ai_metadata_signal" || track.manifest.provenance?.outcome === "role_corroborated";
      await rights.apply(auth.user.id, action, reviewRights(record.declaration, track.manifest.originCategory, new Date(), aiSignal));
    } else if (action.action === "submit") {
      await rights.apply(auth.user.id, {
        ...action, declaration: { ...action.declaration, evidenceDigest: sha256.bytes(Buffer.from(action.declaration.evidenceDocument)) },
      });
    } else {
      await rights.apply(auth.user.id, action);
    }
    return { ok: true };
  });
}
