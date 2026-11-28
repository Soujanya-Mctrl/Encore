import { schnorr } from "@noble/curves/secp256k1";
import type { ProvenanceBinding, ProvenanceProof } from "@encore/contracts";
import { provenanceMessages } from "./schnorr.js";

// Public test keys. Never use these issuers in a deployed environment.
const providerSecret = "00".repeat(31) + "01";
const exporterSecret = "00".repeat(31) + "02";
const credentialSecret = "00".repeat(31) + "03";
const hex = (value: Uint8Array) => Buffer.from(value).toString("hex");
export const fixtureIssuers = {
  provider: hex(schnorr.getPublicKey(providerSecret)),
  exporter: hex(schnorr.getPublicKey(exporterSecret)),
};

export function signedFixture(binding: ProvenanceBinding, graphHash: string): ProvenanceProof {
  const credentialKey = hex(schnorr.getPublicKey(credentialSecret));
  const messages = provenanceMessages(binding, credentialKey, graphHash);
  return {
    binding, graphHash, credentialKey,
    contributionSignature: hex(schnorr.sign(messages.contribution, providerSecret)),
    exportSignature: hex(schnorr.sign(messages.exported, exporterSecret)),
    possessionProof: hex(schnorr.sign(messages.possession, credentialSecret)),
  };
}
