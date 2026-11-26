export const QUEUE_NAMES = [
  "provenance",
  "settlement",
  "licensing",
  "opportunities",
  "notifications",
  "dead_letter"
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export const JOB_TYPES = {
  PROVENANCE_VALIDATE_EVIDENCE: "provenance.validate_evidence",
  PROVENANCE_HASH_MANIFEST: "provenance.hash_manifest",
  SETTLEMENT_INDEX_TX: "settlement.index_tx",
  SETTLEMENT_RECONCILE: "settlement.reconcile",
  LICENSING_CHECK_EXPIRY: "licensing.check_expiry",
  OPPORTUNITIES_EXTRACT_BRIEF: "opportunities.extract_brief",
  NOTIFICATIONS_DELIVER: "notifications.deliver"
} as const;
