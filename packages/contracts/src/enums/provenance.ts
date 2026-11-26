export const ORIGIN_CATEGORIES = [
  "HUMAN_CREATED",
  "AI_ASSISTED",
  "AI_GENERATED",
  "UNKNOWN"
] as const;
export type OriginCategory = (typeof ORIGIN_CATEGORIES)[number];

export const EVIDENCE_STATUSES = [
  "SELF_DECLARED",
  "CORROBORATED",
  "UNVERIFIED",
  "DISPUTED"
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const RIGHTS_STATUSES = [
  "PREVIEW_ALLOWED",
  "EXTERNAL_LICENSE_ONLY",
  "COMMERCIAL_CLEARED",
  "RESTRICTED",
  "DISPUTED"
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];
