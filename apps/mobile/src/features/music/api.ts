import type { CatalogQuery, DiscoveryResult, DiscoveryTrack, MusicPassportManifest, PreviewSource, RightsAction, RightsWorkspace } from "@encore/contracts";
import { encoreApiFetch } from "@/lib/api-client";

export function discover(query: CatalogQuery, signal?: AbortSignal) {
  const search = new URLSearchParams({ page: String(query.page) });
  if (query.q) search.set("q", query.q);
  if (query.origin) search.set("origin", query.origin);
  if (query.genre) search.set("genre", query.genre);
  if (query.evidence) search.set("evidence", query.evidence);
  return encoreApiFetch<DiscoveryResult>(`/api/v1/tracks?${search}`, { signal });
}

export function readTrack(id: string, bearerToken?: string) {
  return encoreApiFetch<{ track: DiscoveryTrack; history: { manifest: MusicPassportManifest; manifest_hash: string }[] }>(
    `/api/v1/tracks/${encodeURIComponent(id)}`, { bearerToken });
}
export function previewSource(id: string) {
  return encoreApiFetch<PreviewSource>(`/api/v1/tracks/${encodeURIComponent(id)}/play?format=json`, { cache: "no-store" });
}
export function rightsWorkspace(query: string, bearerToken?: string) {
  return encoreApiFetch<RightsWorkspace>(`/api/v1/rights${query}`, { bearerToken, cache: "no-store" });
}
export function writeRights(action: RightsAction, bearerToken?: string) {
  return encoreApiFetch<{ ok: true }>("/api/v1/rights", { method: "POST", body: JSON.stringify(action), bearerToken });
}
