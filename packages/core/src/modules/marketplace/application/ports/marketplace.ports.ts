import type { TrackPassportSummary } from "@encore/contracts";
import type {
  CampaignEntity,
  CampaignMilestoneEntity,
  CampaignReviewEntity,
  DistributionApprovalEntity,
  DistributionCycleEntity,
  MarketplaceSnapshot,
  OpinionMarketEntity,
  PassSeriesEntity,
  SpotFillEntity,
  SpotListingEntity,
  SupportReceiptEntity,
  SupporterPassEntity
} from "../../domain/marketplace.entities.js";

export interface UnsignedChainTransaction {
  readonly instructionName: string;
  readonly serializedBase64: string;
  readonly expectedSigners: readonly string[];
  readonly programId: string;
}

export interface MarketplaceChainPort {
  buildDirectSupportTx(params: {
    payerWallet: string;
    artistWallet: string;
    trackId: string;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
    nonce: string;
  }): Promise<UnsignedChainTransaction>;

  buildPrimaryPassPurchaseTx(params: {
    buyerWallet: string;
    artistWallet: string;
    seriesId: string;
    serial: number;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction>;

  buildListingPurchaseTx(params: {
    buyerWallet: string;
    sellerWallet: string;
    artistWallet: string;
    passId: string;
    nonce: number;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction>;
}

export interface MarketplaceRepositoryPort {
  getMarketplaceSnapshot(): Promise<MarketplaceSnapshot>;
  getTrackPassport(trackId: string): Promise<TrackPassportSummary | null>;
  getSeriesById(seriesId: string): Promise<PassSeriesEntity | null>;
  createSeries(series: PassSeriesEntity): Promise<PassSeriesEntity>;
  getPassById(passId: string): Promise<SupporterPassEntity | null>;
  listPassesByOwner(userId: string): Promise<SupporterPassEntity[]>;
  savePass(pass: SupporterPassEntity): Promise<SupporterPassEntity>;
  incrementSeriesIssued(seriesId: string): Promise<PassSeriesEntity>;
  recordSupportReceipt(receipt: SupportReceiptEntity): Promise<SupportReceiptEntity>;
  getReceiptBySignature(signature: string): Promise<SupportReceiptEntity | null>;
  listReceiptsForUser(userId: string): Promise<SupportReceiptEntity[]>;

  // Layer 2 (Devnet / Demo Scope)
  getCampaignById(campaignId: string): Promise<CampaignEntity | null>;
  recordCampaignPledge(params: {
    campaignId: string;
    userId: string;
    amountSmallestUnits: string;
  }): Promise<CampaignEntity>;
  getCampaignPledgeAmount(campaignId: string, userId: string): Promise<string>;
  markCampaignRefundClaimed(campaignId: string, userId: string): Promise<boolean>;
  getSpotListingById(spotListingId: string): Promise<SpotListingEntity | null>;
  saveSpotListing(listing: SpotListingEntity): Promise<SpotListingEntity>;
  fillSpotListing(params: {
    spotListingId: string;
    buyerUserId: string;
    units: number;
  }): Promise<SpotListingEntity>;
  listSpotFills(campaignId?: string): Promise<SpotFillEntity[]>;
  getDistributionCycleById(cycleId: string): Promise<DistributionCycleEntity | null>;
  saveDistributionCycle(cycle: DistributionCycleEntity): Promise<DistributionCycleEntity>;
  getDistributionApproval(cycleId: string): Promise<DistributionApprovalEntity | null>;
  saveDistributionApproval(approval: DistributionApprovalEntity): Promise<DistributionApprovalEntity>;
  getHolderShareUnits(campaignId: string, userId: string): Promise<number>;
  markDistributionClaimed(cycleId: string, userId: string, amount: string): Promise<boolean>;
  recordCampaignReview(review: CampaignReviewEntity): Promise<CampaignReviewEntity>;
  getMilestoneById(milestoneId: string): Promise<CampaignMilestoneEntity | null>;
  saveMilestone(milestone: CampaignMilestoneEntity): Promise<CampaignMilestoneEntity>;
  getOpinionMarketById(marketId: string): Promise<OpinionMarketEntity | null>;
  recordOpinionTrade(params: {
    marketId: string;
    userId: string;
    side: "YES" | "NO";
    pairsCount: number;
  }): Promise<OpinionMarketEntity>;
}
