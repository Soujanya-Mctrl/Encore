import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CatalogError,
  type CatalogRepositoryPort,
  type MediaStoragePort,
  type Release,
  type ReleaseState,
} from "@encore/core";
import type { CatalogQuery, MusicPassportManifest, ReleaseInput } from "@encore/contracts";
export class SupabaseCatalogRepository implements CatalogRepositoryPort {
  private db: SupabaseClient;
  constructor(url: string, key: string) {
    this.db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  private check(error: unknown) {
    if (error) throw new CatalogError("Catalog storage operation failed", 503);
  }
  async create(r: Release) {
    const { error } = await this.db.rpc("encore_create_release", {
      release: r,
    });
    this.check(error);
  }
  async get(id: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return null;
    const { data, error } = await this.db
      .from("catalog_releases")
      .select("payload")
      .eq("id", id)
      .maybeSingle();
    this.check(error);
    return (data?.payload as Release) ?? null;
  }
  async mine(id: string) {
    const { data, error } = await this.db
      .from("catalog_releases")
      .select("payload")
      .eq("artist_id", id)
      .order("created_at", { ascending: false });
    this.check(error);
    return (data ?? []).map((r) => r.payload as Release);
  }
  async search(q: CatalogQuery) {
    let query = this.db
      .from("catalog_releases")
      .select("payload", { count: "exact" })
      .eq("status", "published")
      .eq("paused", false);
    if (q.origin) query = query.eq("origin", q.origin);
    if (q.genre) query = query.eq("genre", q.genre);
    if (q.q)
      query = query.textSearch("search_document", q.q, {
        type: "websearch",
        config: "simple",
      });
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range((q.page - 1) * 12, q.page * 12 - 1);
    this.check(error);
    return {
      tracks: (data ?? []).map((r) => r.payload as Release),
      total: count ?? 0,
    };
  }
  async transition(
    id: string,
    expected: ReleaseState,
    next: ReleaseState,
    actor: string,
    expectedVersion?: number,
  ) {
    const { error } = expectedVersion === undefined ? await this.db.rpc("encore_transition_release", {
      release_id: id,
      expected_state: expected,
      next_state: next,
      actor_id: actor,
    }) : await this.db.rpc("encore_submit_studio_release", {
      release_id: id,
      owner_id: actor,
      expected_version: expectedVersion,
    });
    if (error)
      throw new CatalogError(
        "Release state changed or operation is not allowed",
        409,
      );
  }
  async append(
    id: string,
    artistId: string,
    expectedVersion: number,
    manifest: MusicPassportManifest,
    hash: string,
    metadata?: Pick<ReleaseInput, "title" | "artistName" | "genre" | "description">,
  ) {
    const studioWrite = Boolean(metadata || manifest.provenance);
    const { error } = await this.db.rpc(studioWrite ? "encore_edit_studio_release" : "encore_append_passport", {
      release_id: id,
      owner_id: artistId,
      expected_version: expectedVersion,
      manifest,
      manifest_hash: hash,
      ...(studioWrite ? { metadata: metadata ?? null } : {}),
    });
    if (error)
      throw new CatalogError("Release changed; refresh and try again", 409);
  }
  async delist(id: string, owner: string, version: number) {
    const { error } = await this.db.rpc("encore_delist_studio_release", {
      release_id: id, owner_id: owner, expected_version: version,
    });
    if (error) throw new CatalogError("Publication changed or is unavailable", 409);
  }
  async publish(id: string, hash: string, signature: string, owner: string) {
    const { error } = await this.db.rpc("encore_publish_release", {
      release_id: id,
      expected_hash: hash,
      signature,
      owner_id: owner,
    });
    if (error) throw new CatalogError("Publication state changed", 409);
  }
  async pending() {
    const { data, error } = await this.db
      .from("catalog_releases")
      .select("payload")
      .eq("status", "submitted")
      .order("created_at");
    this.check(error);
    return (data ?? []).map((r) => r.payload as Release);
  }
  async history(id: string) {
    const { data, error } = await this.db
      .from("catalog_passports")
      .select("manifest,manifest_hash,audio_hash,created_at")
      .eq("release_id", id)
      .order("version");
    this.check(error);
    return data ?? [];
  }
}
export class SupabaseMediaStorage implements MediaStoragePort {
  private db: SupabaseClient;
  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false } });
  }
  async grant(path:string){const {data,error}=await this.db.storage.from("encore-previews").createSignedUploadUrl(path);if(error||!data)throw new CatalogError("Upload grant unavailable",503);return data.signedUrl}
  async download(path:string){const {data,error}=await this.db.storage.from("encore-previews").download(path);if(error||!data)throw new CatalogError("Uploaded audio not found",404);if(data.size>20*1024*1024)throw new CatalogError("Audio exceeds 20 MB",413);return new Uint8Array(await data.arrayBuffer())}
  async put(path: string, bytes: Uint8Array) {
    const { error } = await this.db.storage
      .from("encore-previews")
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: false });
    if (error) throw new CatalogError("Audio upload failed", 503);
  }
  async remove(path: string) {
    const { error } = await this.db.storage
      .from("encore-previews")
      .remove([path]);
    if (error) throw new CatalogError("Audio cleanup failed", 503);
  }
  async preview(path: string) {
    const { data, error } = await this.db.storage
      .from("encore-previews")
      .createSignedUrl(path, 60);
    if (error || !data)
      throw new CatalogError("Playback temporarily unavailable", 503);
    return data.signedUrl;
  }
}
