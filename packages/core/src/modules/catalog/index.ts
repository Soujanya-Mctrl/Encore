import type {
  ReleaseInput,
  CatalogQuery,
  MusicPassportManifest,
  ProvenanceBinding,
  ProvenanceProof,
  ProvenanceResult,
  ProvenanceSubmission,
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
    expectedVersion?: number,
  ): Promise<void>;
  append(
    id: string,
    artistId: string,
    expectedVersion: number,
    manifest: MusicPassportManifest,
    hash: string,
    metadata?: Pick<ReleaseInput, "title" | "artistName" | "genre" | "description">,
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
  inspect(bytes: Uint8Array): { durationSeconds: number; metadataSignal?: "ai_metadata_signal" };
}
export interface ProvenanceVerifierPort {
  readonly mode: ProvenanceResult["mode"];
  readonly issuerSetHash: string | null;
  verify(proof: ProvenanceProof): boolean;
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
    const { durationSeconds, metadataSignal } = this.audio.inspect(bytes);
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
      evidenceStatus: "UNVERIFIED",
      rightsStatus: "PREVIEW_ALLOWED",
      contributions: input.contributions,
      ...(metadataSignal ? { metadataSignal } : {}),
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
  async submit(id: string, artistId: string, expectedVersion?: number) {
    const r = await this.owned(id, artistId);
    if (r.status !== "draft")
      throw new CatalogError("Only a draft can be submitted", 409);
    await this.repo.transition(id, "draft", "submitted", artistId, expectedVersion);
  }
  async revise(
    id: string,
    artistId: string,
    input: ReleaseInput | Pick<ReleaseInput, "originCategory" | "contributions">,
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
      trackId: r.id,
      version: expectedVersion + 1,
      previousHash: r.manifestHash,
      originCategory: input.originCategory,
      contributions: input.contributions,
      evidenceStatus: "UNVERIFIED",
      rightsStatus: r.manifest.rightsStatus,
      ...(r.manifest.metadataSignal ? { metadataSignal: r.manifest.metadataSignal } : {}),
    };
    await this.repo.append(
      id,
      artistId,
      expectedVersion,
      manifest,
      this.digest.hash({ ...manifest, audioHash: r.audioHash }),
      "title" in input ? { title: input.title, artistName: input.artistName, genre: input.genre, description: input.description } : undefined,
    );
  }
  proofBinding(release: Release, issuerSetHash: string): ProvenanceBinding {
    return {
      trackId: release.id,
      passportVersion: release.manifest.version + 1,
      audioHash: release.audioHash,
      policyVersion: 1,
      issuerSetHash,
    };
  }
  async verifyProvenance(id: string, artistId: string, input: ProvenanceSubmission, verifier: ProvenanceVerifierPort) {
    const release = await this.owned(id, artistId);
    if ((verifier.mode === "real" && input.demoScenario) || (verifier.mode === "simulated" && input.proof)) {
      throw new CatalogError("Evidence must match the configured verification mode");
    }
    const proofDigest = this.digest.hash({ mode: verifier.mode, issuerSetHash: verifier.issuerSetHash, input });
    const isRetry = (candidate: Release | null) => candidate?.artistId === artistId &&
      candidate.manifest.version === input.expectedVersion + 1 &&
      candidate.manifest.provenance?.proofDigest === proofDigest;
    if (isRetry(release)) return release;
    if (release.status !== "draft" || release.manifest.version !== input.expectedVersion) {
      throw new CatalogError("Provenance requires the current editable draft", 409);
    }
    const result: ProvenanceResult = {
      mode: verifier.mode,
      outcome: "unverified",
      reason: "missing_evidence",
      policyVersion: 1,
      issuerSetHash: verifier.issuerSetHash,
      graphHash: null,
      proofDigest,
    };
    if (release.manifest.originCategory === "HUMAN_CREATED" &&
        (release.manifest.metadataSignal || input.demoScenario === "ai_signal")) {
      result.reason = "ai_metadata_signal";
    } else if (verifier.mode === "simulated" && input.demoScenario === "supported") {
      result.outcome = "simulated_supported";
      result.reason = "demo_fixture";
    } else if (input.proof) {
      if (!verifier.issuerSetHash) throw new CatalogError("Trusted issuers are not configured", 503);
      if (this.digest.hash(input.proof.binding) !== this.digest.hash(this.proofBinding(release, verifier.issuerSetHash))) {
        result.reason = "binding_mismatch";
      } else if (!verifier.verify(input.proof)) {
        result.reason = "invalid_proof";
      } else {
        result.outcome = "role_corroborated";
        result.reason = release.manifest.originCategory === "HUMAN_CREATED" ? "unsupported_claim" : "signed_instrumental";
        result.graphHash = input.proof.graphHash;
      }
    }
    const manifest: MusicPassportManifest = {
      ...release.manifest,
      version: input.expectedVersion + 1,
      previousHash: release.manifestHash,
      evidenceStatus: "UNVERIFIED",
      provenance: result,
    };
    const manifestHash = this.digest.hash({ ...manifest, audioHash: release.audioHash });
    try {
      await this.repo.append(id, artistId, input.expectedVersion, manifest, manifestHash);
    } catch (error) {
      const current = await this.repo.get(id).catch(() => null);
      if (current && isRetry(current)) return current;
      throw error;
    }
    return { ...release, manifest, manifestHash };
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
