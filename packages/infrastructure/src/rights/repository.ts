import { createClient } from "@supabase/supabase-js";
import type { LicenseInquiry, RightsAction, RightsCapabilities, RightsRecord } from "@encore/contracts";
import { CatalogError, type Release } from "@encore/core";

export class SupabaseRightsRepository {
  private readonly db;
  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async records(tracks: Pick<Release, "id" | "manifest">[]) {
    const records = new Map<string, RightsRecord>();
    if (!tracks.length) return records;
    const versions = new Map(tracks.map((track) => [track.id, track.manifest.version]));
    const { data, error } = await this.db.from("catalog_rights")
      .select("track_id,passport_version,revision,status,declaration,capabilities,review_reason")
      .in("track_id", [...versions.keys()])
      .in("passport_version", [...new Set(versions.values())]);
    if (error) throw new CatalogError("Rights records unavailable", 503);
    for (const record of (data ?? []) as RightsRecord[]) {
      if (versions.get(record.track_id) === record.passport_version) records.set(record.track_id, record);
    }
    return records;
  }

  async canReview(actor: string, target: string) {
    const { data, error } = await this.db.rpc("encore_can_review_rights", { actor, target });
    if (error) throw new CatalogError("Rights permissions unavailable", 503);
    return data === true;
  }

  async reviewQueue(actor: string) {
    const { data, error } = await this.db.rpc("encore_rights_review_queue", { actor });
    if (error) throw new CatalogError("Review queue unavailable", 503);
    return (data ?? []) as RightsRecord[];
  }

  async apply(actor: string, action: RightsAction, capabilities?: RightsCapabilities) {
    const { error } = await this.db.rpc("encore_rights_action", { actor, input: action, permissions: capabilities ?? null });
    if (error) throw new CatalogError("Rights action unavailable for this actor, revision, or current clearance", 409);
  }

  async inbox(userId: string, ownedTracks: Pick<Release, "id" | "title">[]) {
    const columns = "id,track_id,passport_version,requester,scope,status,response";
    const sent = this.db.from("catalog_license_inquiries").select(columns)
      .eq("requester", userId).order("created_at", { ascending: false }).limit(100);
    const received = ownedTracks.length
      ? this.db.from("catalog_license_inquiries").select(columns).in("track_id", ownedTracks.map((t) => t.id))
        .order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null });
    const [outgoing, incoming] = await Promise.all([sent, received]);
    if (outgoing.error || incoming.error) throw new CatalogError("License inbox unavailable", 503);
    const rows = new Map([...(outgoing.data ?? []), ...(incoming.data ?? [])].map((row) => [row.id, row]));
    const titles = new Map(ownedTracks.map((track) => [track.id, track.title]));
    const ids = [...new Set([...rows.values()].map((row) => row.track_id).filter((id) => !titles.has(id)))];
    if (ids.length) {
      const { data, error } = await this.db.from("catalog_releases").select("id,title:payload->>title").in("id", ids);
      if (error) throw new CatalogError("License inbox unavailable", 503);
      for (const track of data ?? []) titles.set(track.id, track.title ?? "Track");
    }
    return [...rows.values()].map(({ requester, ...row }): LicenseInquiry => ({
      ...row, status: row.status as LicenseInquiry["status"],
      title: titles.get(row.track_id) ?? "Track", direction: requester === userId ? "sent" : "received",
    }));
  }
}
