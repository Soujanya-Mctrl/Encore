import { schnorr } from "@noble/curves/secp256k1";
import type { ProvenanceBinding, ProvenanceProof } from "@encore/contracts";
import { sha256 } from "../catalog/media.js";

export interface ProvenanceIssuers {
  readonly provider: string;
  readonly exporter: string;
}

export function issuerSetHash(issuers: ProvenanceIssuers) {
  return sha256.hash({ domain: "encore.issuers.v1", ...issuers });
}

export function provenanceMessages(binding: ProvenanceBinding, credentialKey: string, graphHash: string) {
  const record = { binding, credentialKey, role: "instrumental", operation: "generate" };
  const contribution = sha256.hash({ domain: "encore.contribution.v1", record });
  const exported = sha256.hash({ domain: "encore.export.v1", binding, graphHash, contribution });
  const possession = sha256.hash({ domain: "encore.possession.v1", contribution, exported });
  return { contribution, exported, possession };
}

export function verifyContributionProof(proof: ProvenanceProof, issuers: ProvenanceIssuers) {
  if (issuers.provider === issuers.exporter ||
      proof.credentialKey === issuers.provider || proof.credentialKey === issuers.exporter) return false;
  const { contribution, exported, possession } = provenanceMessages(proof.binding, proof.credentialKey, proof.graphHash);
  return schnorr.verify(proof.contributionSignature, contribution, issuers.provider) &&
    schnorr.verify(proof.exportSignature, exported, issuers.exporter) &&
    schnorr.verify(proof.possessionProof, possession, proof.credentialKey);
}
