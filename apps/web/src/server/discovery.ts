import "server-only";
import type { CatalogQuery, DiscoveryTrack } from "@encore/contracts";
import { effectiveRights, restrictedRights, type Release } from "@encore/core";
import { catalog } from "./catalog";

export async function discoveryTracks(tracks: Release[]): Promise<DiscoveryTrack[]> {
  const records = await catalog().rights.records(tracks);
  const now = new Date();
  return tracks.map(({ audioPath, ...track }) => ({
    ...track,
    rights: track.status === "published" && !track.paused ? effectiveRights(records.get(track.id), now) : restrictedRights(),
  }));
}

export async function searchDiscovery(query: CatalogQuery) {
  const { tracks, total } = await catalog().repo.search(query);
  return { tracks: await discoveryTracks(tracks), total };
}
