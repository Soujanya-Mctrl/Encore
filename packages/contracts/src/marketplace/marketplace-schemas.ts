import { z } from "zod";
import { SolanaAddressSchema } from "../auth/auth-schemas.js";
import { ORIGIN_CATEGORIES, EVIDENCE_STATUSES, RIGHTS_STATUSES } from "../enums/provenance.js";

export const PASS_SERIES_STATUSES = ["ACTIVE", "PAUSED", "CLOSED"] as const;
export type PassSeriesStatus = (typeof PASS_SERIES_STATUSES)[number];

export const SUPPORTER_PASS_STATUSES = [
  "OFFERED",
  "OWNED",
  "LISTED",
  "REDEEMED",
  "EXPIRED"
] as const;
export type SupporterPassStatus = (typeof SUPPORTER_PASS_STATUSES)[number];

export const CAMPAIGN_STATUSES = ["FUNDING", "FUNDED", "FAILED"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const OPINION_OUTCOMES = ["UNRESOLVED", "YES", "NO"] as const;
export type OpinionOutcome = (typeof OPINION_OUTCOMES)[number];

export const PositiveAtomicAmountSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, "Amount must be a positive integer in smallest token units");

export const DirectSupportIntentInputSchema = z.object({
  trackId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  expectedManifestHash: z.string().length(64),
  amountSmallestUnits: PositiveAtomicAmountSchema,
  walletMode: z.enum(["external_anchor", "pollar_embedded_spl"]).default("external_anchor")
});

export const CreatePassSeriesInputSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(2).max(100),
  benefitSummary: z.string().min(5).max(500),
  cap: z.number().int().positive().max(10000),
  primaryPriceSmallestUnits: PositiveAtomicAmountSchema,
  expiryIso: z.string().datetime()
});

export const BuyPrimaryPassInputSchema = z.object({
  seriesId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  expectedManifestHash: z.string().length(64)
});

export const ListPassInputSchema = z.object({
  passId: z.string().min(1),
  listingPriceSmallestUnits: PositiveAtomicAmountSchema,
  listingExpiryIso: z.string().datetime()
});

export const BuyListingInputSchema = z.object({
  passId: z.string().min(1),
  expectedNonce: z.number().int().nonnegative(),
  expectedVersion: z.number().int().positive(),
  expectedManifestHash: z.string().length(64)
});

export const RedeemPassInputSchema = z.object({
  passId: z.string().min(1)
});

export const CreateCampaignInputSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(3).max(120),
  goalSmallestUnits: PositiveAtomicAmountSchema,
  shareSupply: z.number().int().positive().max(1_000_000),
  deadlineIso: z.string().datetime(),
  useOfFunds: z.string().min(10).max(500),
  rightsScope: z.string().min(5).max(300)
});

export const CampaignPledgeInputSchema = z.object({
  campaignId: z.string().min(1),
  amountSmallestUnits: PositiveAtomicAmountSchema
});

export const CreateSpotListingInputSchema = z.object({
  campaignId: z.string().min(1),
  units: z.number().int().positive(),
  unitPriceSmallestUnits: PositiveAtomicAmountSchema
});

export const BuySpotListingInputSchema = z.object({
  spotListingId: z.string().min(1),
  units: z.number().int().positive()
});

export const DistributionClaimInputSchema = z.object({
  cycleId: z.string().min(1)
});

export const CancelPassListingInputSchema = z.object({
  passId: z.string().min(1)
});

export const CancelSpotListingInputSchema = z.object({
  spotListingId: z.string().min(1)
});

export const RefundCampaignInputSchema = z.object({
  campaignId: z.string().min(1)
});

export const ReviewCampaignInputSchema = z.object({
  campaignId: z.string().min(1),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  notes: z.string().max(1000).default(""),
  termsHash: z.string().length(64).optional()
});

export const SubmitMilestoneInputSchema = z.object({
  milestoneId: z.string().min(1),
  evidenceUri: z.string().url().max(500)
});

export const ApproveMilestoneInputSchema = z.object({
  milestoneId: z.string().min(1),
  approved: z.boolean()
});

export const ReconcileDistributionInputSchema = z.object({
  cycleId: z.string().min(1),
  evidenceHash: z.string().length(64),
  verifiedRevenueSmallestUnits: PositiveAtomicAmountSchema
});

export const FundDistributionInputSchema = z.object({
  cycleId: z.string().min(1),
  fundedTxSig: z.string().min(32).max(128)
});

export const TRANSACTION_LIFECYCLE_STATES = [
  "review",
  "wallet",
  "submitted",
  "pending",
  "finalized",
  "failed",
  "expired"
] as const;
export type TransactionLifecycleState = (typeof TRANSACTION_LIFECYCLE_STATES)[number];

export const OpinionTradeInputSchema = z.object({
  marketId: z.string().min(1),
  side: z.enum(["YES", "NO"]),
  pairsCount: z.number().int().positive().max(10000)
});

export const TrackPassportSummarySchema = z.object({
  trackId: z.string(),
  title: z.string(),
  artistName: z.string(),
  artistWallet: SolanaAddressSchema,
  currentVersion: z.number().int().positive(),
  manifestHash: z.string().length(64),
  paused: z.boolean(),
  originCategory: z.enum(ORIGIN_CATEGORIES),
  evidenceStatus: z.enum(EVIDENCE_STATUSES),
  rightsStatus: z.enum(RIGHTS_STATUSES)
});

export type DirectSupportIntentInput = z.infer<typeof DirectSupportIntentInputSchema>;
export type CreatePassSeriesInput = z.infer<typeof CreatePassSeriesInputSchema>;
export type BuyPrimaryPassInput = z.infer<typeof BuyPrimaryPassInputSchema>;
export type ListPassInput = z.infer<typeof ListPassInputSchema>;
export type BuyListingInput = z.infer<typeof BuyListingInputSchema>;
export type RedeemPassInput = z.infer<typeof RedeemPassInputSchema>;
export type CreateCampaignInput = z.infer<typeof CreateCampaignInputSchema>;
export type CampaignPledgeInput = z.infer<typeof CampaignPledgeInputSchema>;
export type CreateSpotListingInput = z.infer<typeof CreateSpotListingInputSchema>;
export type BuySpotListingInput = z.infer<typeof BuySpotListingInputSchema>;
export type DistributionClaimInput = z.infer<typeof DistributionClaimInputSchema>;
export type CancelPassListingInput = z.infer<typeof CancelPassListingInputSchema>;
export type CancelSpotListingInput = z.infer<typeof CancelSpotListingInputSchema>;
export type RefundCampaignInput = z.infer<typeof RefundCampaignInputSchema>;
export type ReviewCampaignInput = z.infer<typeof ReviewCampaignInputSchema>;
export type SubmitMilestoneInput = z.infer<typeof SubmitMilestoneInputSchema>;
export type ApproveMilestoneInput = z.infer<typeof ApproveMilestoneInputSchema>;
export type ReconcileDistributionInput = z.infer<typeof ReconcileDistributionInputSchema>;
export type FundDistributionInput = z.infer<typeof FundDistributionInputSchema>;
export type OpinionTradeInput = z.infer<typeof OpinionTradeInputSchema>;
export type TrackPassportSummary = z.infer<typeof TrackPassportSummarySchema>;

export interface MarketplaceSnapshotDto {
  tracks: TrackPassportSummary[];
  series: Array<{
    id: string;
    trackId: string;
    title: string;
    benefitSummary: string;
    cap: number;
    issued: number;
    primaryPriceSmallestUnits: string;
    status: PassSeriesStatus;
  }>;
  campaigns: Array<{
    id: string;
    trackId: string;
    title: string;
    goalSmallestUnits: string;
    raisedSmallestUnits: string;
    useOfFunds: string;
    status: CampaignStatus;
  }>;
  spotListings: Array<{
    id: string;
    campaignId: string;
    remainingUnits: number;
    unitPriceSmallestUnits: string;
    active: boolean;
  }>;
  opinionMarkets: Array<{
    id: string;
    campaignId: string;
    question: string;
    yesPoolPairs: number;
    noPoolPairs: number;
    resolvedOutcome: OpinionOutcome;
  }>;
  candles: Array<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  candlesLastUpdatedAt: string | null;
}
