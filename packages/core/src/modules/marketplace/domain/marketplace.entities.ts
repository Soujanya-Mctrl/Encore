import type {
  CampaignStatus,
  OpinionOutcome,
  PassSeriesStatus,
  SupporterPassStatus,
  TrackPassportSummary
} from "@encore/contracts";

export interface PassSeriesEntity {
  readonly id: string;
  readonly trackId: string;
  readonly artistUserId: string;
  readonly artistWallet: string;
  readonly title: string;
  readonly benefitSummary: string;
  readonly cap: number;
  readonly issued: number;
  readonly primaryPriceSmallestUnits: string;
  readonly expiry: Date;
  readonly status: PassSeriesStatus;
  readonly deliverableUrl: string;
}

export interface SupporterPassEntity {
  readonly id: string;
  readonly seriesId: string;
  readonly trackId: string;
  readonly serial: number;
  readonly ownerUserId: string;
  readonly ownerWallet: string;
  readonly status: SupporterPassStatus;
  readonly nonce: number;
  readonly listingPriceSmallestUnits: string | null;
  readonly listingExpiry: Date | null;
}

export interface SupportReceiptEntity {
  readonly id: string;
  readonly payerUserId: string;
  readonly payerWallet: string;
  readonly trackId: string;
  readonly passportVersion: number;
  readonly manifestHash: string;
  readonly amountSmallestUnits: string;
  readonly artistWallet: string;
  readonly signature: string;
  readonly walletMode: "external_anchor" | "pollar_embedded_spl";
  readonly createdAt: Date;
}

export interface CampaignEntity {
  readonly id: string;
  readonly trackId: string;
  readonly artistUserId: string;
  readonly artistWallet: string;
  readonly title: string;
  readonly goalSmallestUnits: string;
  readonly raisedSmallestUnits: string;
  readonly shareSupply: number;
  readonly deadline: Date;
  readonly useOfFunds: string;
  readonly rightsScope: string;
  readonly status: CampaignStatus;
  readonly vaultAddress: string;
}

export interface SpotListingEntity {
  readonly id: string;
  readonly campaignId: string;
  readonly sellerUserId: string;
  readonly sellerWallet: string;
  readonly remainingUnits: number;
  readonly unitPriceSmallestUnits: string;
  readonly active: boolean;
}

export interface DistributionCycleEntity {
  readonly id: string;
  readonly campaignId: string;
  readonly periodLabel: string;
  readonly verifiedRevenueSmallestUnits: string;
  readonly claimedSmallestUnits: string;
  readonly totalSupplySnapshot: number;
  readonly recordDate: Date;
}

export interface OpinionMarketEntity {
  readonly id: string;
  readonly campaignId: string;
  readonly question: string;
  readonly tradingCutoff: Date;
  readonly campaignDeadline: Date;
  readonly vaultAddress: string;
  readonly yesPoolPairs: number;
  readonly noPoolPairs: number;
  readonly resolvedOutcome: OpinionOutcome;
}

export interface CandlePoint {
  readonly time: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

export interface SpotFillEntity {
  readonly id: string;
  readonly spotListingId: string;
  readonly campaignId: string;
  readonly buyerUserId: string;
  readonly sellerUserId: string;
  readonly units: number;
  readonly unitPriceSmallestUnits: string;
  readonly txSignature: string;
  readonly filledAt: Date;
}

export interface CampaignReviewEntity {
  readonly id: string;
  readonly campaignId: string;
  readonly reviewerUserId: string;
  readonly decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  readonly notes: string;
  readonly termsHash: string | null;
  readonly createdAt: Date;
}

export interface CampaignMilestoneEntity {
  readonly id: string;
  readonly campaignId: string;
  readonly sequenceIndex: number;
  readonly title: string;
  readonly releaseAmountSmallestUnits: string;
  readonly evidenceUri: string | null;
  readonly status: "PENDING" | "SUBMITTED" | "APPROVED" | "RELEASED" | "REJECTED";
  readonly reviewerUserId: string | null;
  readonly updatedAt: Date;
}

export interface DistributionApprovalEntity {
  readonly cycleId: string;
  readonly operatorUserId: string;
  readonly approverUserId: string | null;
  readonly evidenceHash: string;
  readonly reconciledAt: Date;
  readonly approvedAt: Date | null;
  readonly fundedTxSig: string | null;
  readonly status: "RECONCILED" | "FUNDED_AND_OPEN";
}

export interface MarketplaceSnapshot {
  readonly tracks: TrackPassportSummary[];
  readonly series: PassSeriesEntity[];
  readonly listedPasses: SupporterPassEntity[];
  readonly campaigns: CampaignEntity[];
  readonly spotListings: SpotListingEntity[];
  readonly distributionCycles: DistributionCycleEntity[];
  readonly opinionMarkets: OpinionMarketEntity[];
  readonly candles: CandlePoint[];
  readonly candlesLastUpdatedAt: string | null;
}
