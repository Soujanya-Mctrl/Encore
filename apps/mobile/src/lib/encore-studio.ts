import type { MusicPassportManifest, ProvenanceBinding, ProvenanceResult, ProvenanceSubmission, ReleaseInput, StudioDraftEdit, StudioTrack } from "@encore/contracts";
import { encoreApiFetch } from "./api-client";

type Session = string | undefined;
type StudioChannel = { id: string; displayName: string; handle: string; role: "owner" };
type StudioProfile = { displayName: string; avatarUrl?: string; preferredGenres?: string[] };
type PassportRevision = { manifest: MusicPassportManifest; manifest_hash: string; audio_hash: string; created_at: string };

const path = (id: string) => `/api/v1/studio/tracks/${encodeURIComponent(id)}`;
const releasePath = (id: string) => `/api/v1/tracks/${encodeURIComponent(id)}`;
const json = (method: string, body: unknown, bearerToken: Session) => ({
  method, bearerToken, body: JSON.stringify(body)
});

export function enableStudio(profile: StudioProfile, token?: Session) {
  return encoreApiFetch<{ channel: StudioChannel }>("/api/v1/studio/enable", json("POST", profile, token));
}

export function listStudioTracks(bearerToken?: Session) {
  return encoreApiFetch<{ channel: StudioChannel; tracks: StudioTrack[] }>("/api/v1/studio/tracks", { bearerToken });
}

export function getStudioTrack(id: string, bearerToken?: Session) {
  return encoreApiFetch<{ track: StudioTrack; history: PassportRevision[] }>(path(id), { bearerToken });
}

export function editStudioTrack(id: string, draft: StudioDraftEdit, token?: Session) {
  return encoreApiFetch<{ ok: true }>(path(id), json("PATCH", draft, token));
}

export function requestStudioUpload(size: number, token?: Session) {
  return encoreApiFetch<{ url: string; grant: string }>("/api/v1/uploads/init", json("POST", { size }, token));
}

export function finalizeStudioUpload(grant: string, metadata: ReleaseInput, token?: Session) {
  return encoreApiFetch<{ track: StudioTrack }>("/api/v1/uploads/finalize", json("POST", { grant, metadata }, token));
}

export function getStudioProvenance(id: string, bearerToken?: Session) {
  return encoreApiFetch<{
    mode: "real" | "simulated"; expectedVersion: number; binding: ProvenanceBinding | null; result: ProvenanceResult | null;
  }>(`${path(id)}/provenance`, { bearerToken });
}

export function verifyStudioProvenance(id: string, evidence: ProvenanceSubmission, token?: Session) {
  return encoreApiFetch<{ manifest: MusicPassportManifest; manifestHash: string }>(
    `${path(id)}/provenance`, json("POST", evidence, token));
}

export function submitStudioTrack(id: string, expectedVersion: number, token?: Session) {
  return encoreApiFetch<{ ok: true }>(`${releasePath(id)}/submit`, json("POST", { expectedVersion }, token));
}

export function prepareStudioAnchor(id: string, address: string, token?: Session) {
  return encoreApiFetch<{
    transactions: string[]; existingSignature?: string; blockhash: string; lastValidBlockHeight: number;
    passport: string; programId: string; cluster: "devnet";
  }>(`${releasePath(id)}/anchor`, json("POST", { address }, token));
}

export function submitStudioAnchor(id: string, address: string, signedTransaction: string, token?: Session) {
  return encoreApiFetch<{ signature: string }>(`${releasePath(id)}/anchor`, json("POST", { address, signedTransaction }, token));
}

export function confirmStudioAnchor(id: string, address: string, signature: string, token?: Session) {
  return encoreApiFetch<{ published: true }>(`${releasePath(id)}/anchor`, json("POST", { address, signature }, token));
}

export function delistStudioTrack(id: string, expectedVersion: number, token?: Session) {
  return encoreApiFetch<{ ok: true }>(`${path(id)}/delist`, json("POST", { expectedVersion }, token));
}
