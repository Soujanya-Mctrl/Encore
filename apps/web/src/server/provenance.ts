import "server-only";
import type { ProvenanceVerifierPort } from "@encore/core";
import { issuerSetHash, verifyContributionProof } from "@encore/infrastructure";

export function provenanceVerifier(): ProvenanceVerifierPort {
  const mode = process.env.ENCORE_PROVENANCE_DEMO ?? "false";
  if (mode !== "true" && mode !== "false") throw new Error("Invalid provenance mode");
  if (mode === "true") return { mode: "simulated", issuerSetHash: null, verify: () => false };
  const provider = process.env.ENCORE_PROVENANCE_PROVIDER_KEY;
  const exporter = process.env.ENCORE_PROVENANCE_EXPORTER_KEY;
  const validKey = /^[0-9a-f]{64}$/;
  if (!provider || !exporter || !validKey.test(provider) || !validKey.test(exporter) || provider === exporter) {
    return { mode: "real", issuerSetHash: null, verify: () => false };
  }
  const issuers = { provider, exporter };
  return { mode: "real", issuerSetHash: issuerSetHash(issuers), verify: (proof) => verifyContributionProof(proof, issuers) };
}
