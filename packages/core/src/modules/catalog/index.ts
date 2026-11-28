import type {
  ReleaseInput,
  CatalogQuery,
  MusicPassportManifest,
} from "@encore/contracts";
export type ReleaseState =
  | "draft"
  | "submitted"
  | "approved"
  | "anchor_pending"
  | "published"
  | "rejected";
export interface Release {
  id: string;
  artistId: string;
  title: string;
  artistName: string;
  genre: string;
  description: string;
  status: ReleaseState;
  paused: boolean;
  audioPath: string;
  audioHash: string;
  durationSeconds: number;
  manifest: MusicPassportManifest;
  manifestHash: string;
  createdAt: string;
  anchorSignature: string | null;
}
export interface CatalogRepositoryPort {
  create(release: Release): Promise<void>;
  get(id: string): Promise<Release | null>;
  mine(artistId: string): Promise<Release[]>;
  search(query: CatalogQuery): Promise<{ tracks: Release[]; total: number }>;
  transition(
    id: string,
    expected: ReleaseState,
    next: ReleaseState,
    actor: string,
  ): Promise<void>;
  append(
    id: string,
    artistId: string,
    expectedVersion: number,
    manifest: MusicPassportManifest,
    hash: string,
  ): Promise<void>;
}
export interface MediaStoragePort {
  put(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  preview(path: string): Promise<string>;
}
export interface DigestPort {
  hash(value: unknown): string;
  bytes(value: Uint8Array): string;
}
export interface AudioInspectorPort {
  inspect(bytes: Uint8Array): { durationSeconds: number };
}
export class CatalogError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export class CatalogService {
  constructor(
    readonly repo: CatalogRepositoryPort,
    readonly storage: MediaStoragePort,
    readonly digest: DigestPort,
    readonly audio: AudioInspectorPort,
    readonly id: () => string,
  ) {}
  async upload(
    artistId: string,
    input: ReleaseInput,
    bytes: Uint8Array,
    releaseId?: string,
  ): Promise<Release> {
    const { durationSeconds } = this.audio.inspect(bytes);
    const id = releaseId ?? this.id();
    const filename = releaseId ? `preview-${this.id()}.mp3` : "preview.mp3";
    const path = `${artistId}/${id}/${filename}`;
    const audioHash = this.digest.bytes(bytes);
    // Category is an artist claim. Evidence and rights remain separate and are never auto-promoted.
    const manifest: MusicPassportManifest = {
      trackId: id,
      version: 1,
      previousHash: null,
      originCategory: input.originCategory,
      evidenceStatus: input.originCategory === "UNKNOWN" ? "UNVERIFIED" : "SELF_DECLARED",
      rightsStatus: "PREVIEW_ALLOWED",
      contributions: input.contributions,
    };
    const release: Release = {
      id,
      artistId,
      title: input.title,
      artistName: input.artistName,
      genre: input.genre,
      description: input.description,
      status: "draft",
      paused: false,
      audioPath: path,
      audioHash,
      durationSeconds,
      manifest,
      manifestHash: this.digest.hash({ ...manifest, audioHash }),
      createdAt: new Date().toISOString(),
      anchorSignature: null,
    };
    await this.storage.put(path, bytes);
    try {
      await this.repo.create(release);
    } catch (error) {
      // A lost DB response can follow a successful commit. Check the persisted
      // object before removing the upload. A concurrent finalize can win too.
      const existing = await this.repo.get(id).catch(() => undefined);
      if (existing !== undefined && existing?.audioPath !== path) {
        await this.storage.remove(path).catch(() => {});
      }
      if (existing?.artistId === artistId && existing.audioHash === audioHash && existing.manifestHash === release.manifestHash) return existing;
      throw error;
    }
    return release;
  }
  async submit(id: string, artistId: string) {
    const r = await this.owned(id, artistId);
    if (r.status !== "draft")
      throw new CatalogError("Only a draft can be submitted", 409);
    await this.repo.transition(id, "draft", "submitted", artistId);
  }
  async revise(
    id: string,
    artistId: string,
    input: Pick<ReleaseInput, "originCategory" | "contributions">,
    expectedVersion: number,
  ) {
    const r = await this.owned(id, artistId);
    if (!["draft", "rejected"].includes(r.status))
      throw new CatalogError(
        "Submitted or published versions are immutable",
        409,
      );
    if (r.manifest.version !== expectedVersion)
      throw new CatalogError("Version changed; reload before editing", 409);
    const manifest: MusicPassportManifest = {
      ...r.manifest,
      version: expectedVersion + 1,
      previousHash: r.manifestHash,
      originCategory: input.originCategory,
      contributions: input.contributions,
      evidenceStatus: input.originCategory === "UNKNOWN" ? "UNVERIFIED" : "SELF_DECLARED",
    };
    await this.repo.append(
      id,
      artistId,
      expectedVersion,
      manifest,
      this.digest.hash({ ...manifest, audioHash: r.audioHash }),
    );
  }
  async review(id: string, reviewerId: string, approve: boolean) {
    const r = await this.repo.get(id);
    if (!r) throw new CatalogError("Track not found", 404);
    if (r.artistId === reviewerId)
      throw new CatalogError("A creator cannot review their own release", 403);
    await this.repo.transition(
      id,
      "submitted",
      approve ? "approved" : "rejected",
      reviewerId,
    );
  }
  async owned(id: string, artistId: string) {
    const r = await this.repo.get(id);
    if (!r) throw new CatalogError("Track not found", 404);
    if (r.artistId !== artistId)
      throw new CatalogError("Track belongs to another artist", 403);
    return r;
  }
}
