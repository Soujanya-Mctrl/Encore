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
  readonly recentBlockhash?: string;
  readonly lastValidBlockHeight?: number;
  readonly cluster?: string;
  readonly accounts?: Record<string, string>;
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

  buildCreateSeriesTx?(params: {
    artistWallet: string;
    trackId: string;
    seriesId: string;
    termsHash: string;
    benefitHash: string;
    cap: number;
    primaryPriceSmallestUnits: string;
    expiryUnixSeconds: number;
  }): Promise<UnsignedChainTransaction>;

  buildPrimaryPassPurchaseTx(params: {
    buyerWallet: string;
    artistWallet: string;
    trackId?: string;
    seriesId: string;
    serial: number;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction>;

  buildListPassTx?(params: {
    ownerWallet: string;
    artistWallet: string;
    trackId: string;
    seriesId: string;
    serial: number;
    listingPriceSmallestUnits: string;
    listingExpiryUnixSeconds: number;
  }): Promise<UnsignedChainTransaction>;

  buildCancelPassListingTx?(params: {
    ownerWallet: string;
    artistWallet: string;
    seriesId: string;
    serial: number;
  }): Promise<UnsignedChainTransaction>;

  buildListingPurchaseTx(params: {
    buyerWallet: string;
    sellerWallet: string;
    artistWallet: string;
    trackId?: string;
    seriesId?: string;
    serial?: number;
    passId: string;
    nonce: number;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction>;

  buildRedeemPassTx?(params: {
    ownerWallet: string;
    artistWallet: string;
    seriesId: string;
    serial: number;
  }): Promise<UnsignedChainTransaction>;

  buildExpirePassTx?(params: {
    payerWallet: string;
    artistWallet: string;
    seriesId: string;
    serial: number;
  }): Promise<UnsignedChainTransaction>;

  buildCreateCampaignTx?(params: {
    artistWallet: string;
    trackId: string;
    campaignId: string;
    termsHash: string;
    goalSmallestUnits: string;
    shareSupply: number;
    deadlineUnixSeconds: number;
  }): Promise<UnsignedChainTransaction>;

  buildCampaignPledgeTx(params: {
    payerWallet: string;
    artistWallet?: string;
    vaultAddress: string;
    campaignId: string;
    nonce?: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction>;

  buildReleaseMilestoneTx?(params: {
    artistWallet: string;
    campaignId: string;
    vaultAddress: string;
    milestoneIndex: number;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction>;

  buildCampaignRefundTx(params: {
    claimerWallet: string;
    artistWallet?: string;
    vaultAddress: string;
    campaignId: string;
    pledgeNonce?: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction>;

  buildCreateSpotListingTx?(params: {
    sellerWallet: string;
    artistWallet: string;
    campaignId: string;
    spotListingId: string;
    units: number;
    unitPriceSmallestUnits: string;
  }): Promise<UnsignedChainTransaction>;

  buildCancelSpotListingTx?(params: {
    sellerWallet: string;
    artistWallet: string;
    campaignId: string;
    spotListingId: string;
  }): Promise<UnsignedChainTransaction>;

  buildSpotBuyTx(params: {
    buyerWallet: string;
    sellerWallet: string;
    artistWallet?: string;
    spotListingId: string;
    campaignId: string;
    units: number;
    expectedNonce?: number;
    unitPriceSmallestUnits: string;
    totalSmallestUnits: string;
  }): Promise<UnsignedChainTransaction>;

  buildOpenDistributionCycleTx?(params: {
    authorityWallet: string;
    artistWallet: string;
    campaignId: string;
    cycleId: string;
    evidenceHash: string;
    merkleRootHex?: string;
    entitlements?: ReadonlyArray<{ claimerWallet: string; amountSmallestUnits: string }>;
    verifiedRevenueSmallestUnits: string;
    totalSupplySnapshot: number;
  }): Promise<UnsignedChainTransaction>;

  buildDistributionClaimTx(params: {
    claimerWallet: string;
    artistWallet?: string;
    vaultAddress: string;
    cycleId: string;
    campaignId: string;
    payoutSmallestUnits: string;
    merkleProofHex?: readonly string[];
    entitlements?: ReadonlyArray<{ claimerWallet: string; amountSmallestUnits: string }>;
  }): Promise<UnsignedChainTransaction>;

  submitSignedTransaction?(signedBase64: string): Promise<{ signature: string }>;

  verifyFinalizedMarketplaceTx?(params: {
    signature: string;
    expectedInstruction: string;
    expectedSigner?: string;
    expectedAccounts?: readonly string[];
  }): Promise<{
    verified: boolean;
    slot: number;
    events: ReadonlyArray<{ name: string; dataBase64: string }>;
    reason?: string;
  }>;

  verifyFinalizedDeposit(params: {
    signature: string;
    expectedDestination: string;
    minimumAmountSmallestUnits: string;
  }): Promise<{
    verified: boolean;
    slot: number;
    actualAmountSmallestUnits: string;
    reason?: string;
  }>;
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
  saveCampaign?(campaign: CampaignEntity): Promise<CampaignEntity>;
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
  getHolderShareUnitsAtRecordDate(
    cycleId: string,
    campaignId: string,
    userId: string,
    recordDate: Date
  ): Promise<number>;
  snapshotCycleHolders(cycleId: string, campaignId: string, recordDate: Date): Promise<void>;
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
  recordChainEvent?(params: {
    signature: string;
    eventIndex: number;
    slot: number;
    eventType: string;
    payload: Record<string, unknown>;
    finality: "confirmed" | "finalized";
  }): Promise<void>;
  getPortfolioForUser?(userId: string): Promise<{
    passes: SupporterPassEntity[];
    receipts: SupportReceiptEntity[];
    spotListings: SpotListingEntity[];
  }>;
  listDistributionEntitlements?(cycleId: string): Promise<
    Array<{
      userId: string;
      walletAddress: string;
      units: number;
    }>
  >;
}
