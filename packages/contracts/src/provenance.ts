import { z } from "zod";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const signature = z.string().regex(/^[a-f0-9]{128}$/);

export const ProvenanceBindingSchema = z.object({
  trackId: z.string().uuid(),
  passportVersion: z.number().int().positive().max(2147483647),
  audioHash: hash,
  policyVersion: z.literal(1),
  issuerSetHash: hash
}).strict();

export const ProvenanceProofSchema = z.object({
  binding: ProvenanceBindingSchema,
  credentialKey: hash,
  graphHash: hash,
  contributionSignature: signature,
  exportSignature: signature,
  possessionProof: signature
}).strict();

export const ProvenanceSubmissionSchema = z.object({
  expectedVersion: z.number().int().positive().max(2147483646),
  proof: ProvenanceProofSchema.optional(),
  demoScenario: z.enum(["supported", "missing", "ai_signal"]).optional()
}).strict();

export const ProvenanceResultSchema = z.object({
  mode: z.enum(["real", "simulated"]),
  outcome: z.enum(["role_corroborated", "simulated_supported", "unverified"]),
  reason: z.enum(["signed_instrumental", "demo_fixture", "missing_evidence", "ai_metadata_signal",
    "invalid_proof", "binding_mismatch", "unsupported_claim"]),
  policyVersion: z.literal(1),
  issuerSetHash: hash.nullable(),
  graphHash: hash.nullable(),
  proofDigest: hash.nullable()
}).strict();

export type ProvenanceProof = z.infer<typeof ProvenanceProofSchema>;
export type ProvenanceBinding = z.infer<typeof ProvenanceBindingSchema>;
export type ProvenanceSubmission = z.infer<typeof ProvenanceSubmissionSchema>;
export type ProvenanceResult = z.infer<typeof ProvenanceResultSchema>;
