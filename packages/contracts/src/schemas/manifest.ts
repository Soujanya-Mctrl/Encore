import { z } from "zod";
import { ORIGIN_CATEGORIES, EVIDENCE_STATUSES, RIGHTS_STATUSES } from "../enums/provenance.js";

export const ContributionSchema = z.object({
  role: z.string().min(1),
  mode: z.enum(["human", "generative_ai", "assisted", "unknown"]),
  creatorRef: z.string().min(1),
  tool: z.string().optional(),
  consent: z.boolean()
});

export const MusicPassportManifestSchema = z.object({
  trackId: z.string().min(1),
  version: z.number().int().positive(),
  previousHash: z.string().length(64).nullable(),
  originCategory: z.enum(ORIGIN_CATEGORIES),
  evidenceStatus: z.enum(EVIDENCE_STATUSES),
  rightsStatus: z.enum(RIGHTS_STATUSES),
  contributions: z.array(ContributionSchema).min(1)
});

export type MusicPassportManifest = z.infer<typeof MusicPassportManifestSchema>;
