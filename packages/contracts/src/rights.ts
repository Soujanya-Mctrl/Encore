import { z } from "zod";

export const RIGHTS_PROVIDERS = ["original", "suno", "elevenlabs", "other", "unknown"] as const;
export const LICENSE_USES = ["social", "marketing", "film", "game", "event", "other"] as const;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.string().datetime({ offset: true });
const trackId = z.string().uuid();

export const RightsDeclarationSchema = z.object({
  provider: z.enum(RIGHTS_PROVIDERS),
  masterAuthority: z.boolean(),
  compositionAuthority: z.boolean(),
  contributorsCleared: z.boolean(),
  inputsCleared: z.boolean(),
  worldwidePreview: z.boolean(),
  evidenceDocument: z.string().trim().min(20).max(16000),
  evidenceDigest: digest.optional(),
  validUntil: date,
  providerPlan: z.enum(["free", "paid", "custom", "unknown"]).optional(),
  generatedAt: date.optional(),
  termsDigest: digest.optional(),
  writtenHostingPermission: z.boolean().default(false),
  providerListing: z.string().url().max(512).optional(),
  licenseUses: z.array(z.enum(LICENSE_USES)).max(LICENSE_USES.length).default([]),
}).strict();

export const RightsActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit"), trackId, version: z.number().int().positive(), declaration: RightsDeclarationSchema }).strict(),
  z.object({ action: z.literal("review"), trackId, version: z.number().int().positive(), revision: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), reason: z.string().trim().min(3).max(500) }).strict(),
  z.object({ action: z.literal("withdraw"), trackId, version: z.number().int().positive(), revision: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("request"), trackId, version: z.number().int().positive(), requestId: z.string().uuid(), use: z.enum(LICENSE_USES), territory: z.string().trim().min(2).max(80), termMonths: z.number().int().min(1).max(120), details: z.string().trim().min(10).max(1000) }).strict(),
  z.object({ action: z.literal("respond"), requestId: z.string().uuid(), decision: z.enum(["accepted_for_discussion", "declined"]), note: z.string().trim().min(3).max(500) }).strict()
]);
export type RightsDeclaration = z.infer<typeof RightsDeclarationSchema>;
export type RightsAction = z.infer<typeof RightsActionSchema>;
export interface RightsCapabilities {
  preview: boolean;
  licenseUses: (typeof LICENSE_USES)[number][];
  externalUrl: string | null;
}
export interface RightsRecord {
  track_id: string;
  passport_version: number;
  revision: number;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  declaration: RightsDeclaration;
  capabilities: RightsCapabilities;
  review_reason: string | null;
}
export interface LicenseInquiry {
  id: string;
  track_id: string;
  passport_version: number;
  title: string;
  direction: "sent" | "received";
  scope: { use: string; territory: string; termMonths: number; details: string };
  status: "pending" | "accepted_for_discussion" | "declined" | "closed";
  response: string | null;
}
export interface RightsWorkspace { records: RightsRecord[]; inquiries: LicenseInquiry[] }
