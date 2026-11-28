import { z } from "zod";
import { ORIGIN_CATEGORIES } from "./enums/provenance.js";
import type { MusicPassportManifest } from "./schemas/manifest.js";
export const ReleaseInputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    artistName: z.string().trim().min(1).max(100),
    genre: z.string().trim().min(1).max(60),
    description: z.string().trim().max(2000),
    originCategory: z.enum(ORIGIN_CATEGORIES),
    previewConsent: z.literal(true),
    contributions: z
      .array(
        z.object({
          role: z.string().trim().min(1).max(80),
          mode: z.enum(["human", "generative_ai", "assisted", "unknown"]),
          creatorRef: z.string().trim().min(1).max(100),
          tool: z.string().max(100).optional(),
          consent: z.literal(true),
        }),
      )
      .min(1)
      .max(30),
  })
  .strict();
export type ReleaseInput = z.infer<typeof ReleaseInputSchema>;
export const StudioDraftEditSchema = z.object({
  expectedVersion: z.number().int().positive().max(2147483646),
  metadata: ReleaseInputSchema,
}).strict();
export type StudioDraftEdit = z.infer<typeof StudioDraftEditSchema>;

export const PassportVersionRequestSchema = z.object({
  expectedVersion: z.number().int().positive().max(2147483647),
}).strict();

export interface StudioTrack {
  id: string;
  artistId: string;
  title: string;
  artistName: string;
  genre: string;
  description: string;
  status: "draft" | "submitted" | "approved" | "anchor_pending" | "published" | "rejected";
  paused: boolean;
  audioHash: string;
  durationSeconds: number;
  manifest: MusicPassportManifest;
  manifestHash: string;
  createdAt: string;
  anchorSignature: string | null;
}
export const CatalogQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  origin: z.enum(ORIGIN_CATEGORIES).optional(),
  genre: z.string().max(60).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
