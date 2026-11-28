import { err, ok, type Result } from "../../../../kernel/result.js";
import type { ClockPort } from "../../../../kernel/ports.js";
import type { TrackPassportSummary } from "@encore/contracts";
import {
  computePrimaryPassSplit,
  computeProRataDistributionClaim,
  computeSecondaryResaleSplit
} from "../../domain/split-math.js";
import type {
  CampaignEntity,
  CampaignMilestoneEntity,
  CampaignReviewEntity,
  CandlePoint,
  DistributionApprovalEntity,
  DistributionCycleEntity,
  OpinionMarketEntity,
  PassSeriesEntity,
  SpotFillEntity,
  SpotListingEntity,
  SupporterPassEntity
} from "../../domain/marketplace.entities.js";
import type {
  MarketplaceChainPort,
  MarketplaceRepositoryPort,
  UnsignedChainTransaction
} from "../ports/marketplace.ports.js";

export function assertPassportEligibleForCommerce(
  passport: TrackPassportSummary | null,
  expectedVersion: number,
  expectedManifestHash: string
): Result<TrackPassportSummary, Error> {
  if (!passport) return err(new Error("Track passport not found"));
  if (passport.paused) {
    return err(new Error("Track commerce is paused due to active moderation or dispute"));
  }
  if (passport.rightsStatus === "DISPUTED" || passport.rightsStatus === "RESTRICTED") {
    return err(new Error(`Track rights status (${passport.rightsStatus}) blocks commerce`));
  }
  if (passport.currentVersion !== expectedVersion) {
    return err(
      new Error(
        `Stale passport version: expected v${expectedVersion}, current is v${passport.currentVersion}`
      )
    );
  }
  if (passport.manifestHash !== expectedManifestHash) {
    return err(new Error("Manifest hash mismatch against current published passport"));
  }
  return ok(passport);
}

export async function prepareDirectSupportIntent(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  params: {
    payerWallet: string;
    trackId: string;
    expectedVersion: number;
    expectedManifestHash: string;
    amountSmallestUnits: string;
  }
): Promise<
  Result<
    {
      passport: TrackPassportSummary;
      nonce: string;
      artistPayout: string;
      platformFee: string;
      unsignedTx: UnsignedChainTransaction;
    },
    Error
  >
> {
  const passport = await repo.getTrackPassport(params.trackId);
  const eligible = assertPassportEligibleForCommerce(
    passport,
    params.expectedVersion,
    params.expectedManifestHash
  );
  if (!eligible.ok) return eligible;

  const amount = BigInt(params.amountSmallestUnits);
  if (amount <= 0n) return err(new Error("Support amount must be positive"));

  const nonce = new DataView(crypto.getRandomValues(new Uint8Array(8)).buffer).getBigUint64(0).toString();
  const unsignedTx = await chain.buildDirectSupportTx({
    payerWallet: params.payerWallet,
    artistWallet: eligible.value.artistWallet,
    trackId: params.trackId,
    version: eligible.value.currentVersion,
    manifestHash: eligible.value.manifestHash,
    amountSmallestUnits: params.amountSmallestUnits,
    nonce
  });

  return ok({
    passport: eligible.value,
    nonce,
    artistPayout: params.amountSmallestUnits, // 0% platform fee on direct tips
    platformFee: "0",
    unsignedTx
  });
}

export async function preparePrimaryPassPurchase(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: {
    buyerWallet: string;
    seriesId: string;
    expectedVersion: number;
    expectedManifestHash: string;
  }
): Promise<
  Result<
    {
      series: PassSeriesEntity;
      split: { artistPayout: string; platformFee: string };
      unsignedTx: UnsignedChainTransaction;
    },
    Error
  >
> {
  const series = await repo.getSeriesById(params.seriesId);
  if (!series) return err(new Error("Pass series not found"));
  if (series.status !== "ACTIVE") return err(new Error("Pass series is not active"));
  if (series.issued >= series.cap) return err(new Error("Pass series supply cap reached"));
  if (series.expiry.getTime() <= clock.now().getTime()) {
    return err(new Error("Pass series has expired"));
  }

  const passport = await repo.getTrackPassport(series.trackId);
  const eligible = assertPassportEligibleForCommerce(
    passport,
    params.expectedVersion,
    params.expectedManifestHash
  );
  if (!eligible.ok) return eligible;

  const split = computePrimaryPassSplit(BigInt(series.primaryPriceSmallestUnits));
  const unsignedTx = await chain.buildPrimaryPassPurchaseTx({
    buyerWallet: params.buyerWallet,
    artistWallet: series.artistWallet,
    trackId: series.trackId,
    seriesId: series.id,
    serial: series.issued + 1,
    version: eligible.value.currentVersion,
    manifestHash: eligible.value.manifestHash,
    amountSmallestUnits: series.primaryPriceSmallestUnits
  });

  return ok({
    series,
    split: {
      artistPayout: split.artistPayout.toString(),
      platformFee: split.platformFee.toString()
    },
    unsignedTx
  });
}

export async function listOwnedPassForSale(
  repo: MarketplaceRepositoryPort,
  clock: ClockPort,
  params: {
    actorUserId: string;
    passId: string;
    listingPriceSmallestUnits: string;
    listingExpiry: Date;
  }
): Promise<Result<SupporterPassEntity, Error>> {
  const pass = await repo.getPassById(params.passId);
  if (!pass) return err(new Error("Supporter pass not found"));
  if (pass.ownerUserId !== params.actorUserId) {
    return err(new Error("Only the pass owner can list this pass"));
  }
  if (pass.status !== "OWNED") {
    return err(new Error(`Cannot list pass in ${pass.status} state`));
  }
  const series = await repo.getSeriesById(pass.seriesId);
  if (!series || series.expiry.getTime() <= clock.now().getTime()) {
    return err(new Error("Cannot list an expired pass"));
  }
  if (params.listingExpiry.getTime() <= clock.now().getTime()) {
    return err(new Error("Listing expiry must be in the future"));
  }

  const updated = await repo.savePass({
    ...pass,
    status: "LISTED",
    nonce: pass.nonce + 1,
    listingPriceSmallestUnits: params.listingPriceSmallestUnits,
    listingExpiry: params.listingExpiry
  });
  return ok(updated);
}

export async function prepareBuyListedPass(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: {
    buyerUserId: string;
    buyerWallet: string;
    passId: string;
    expectedNonce: number;
    expectedVersion: number;
    expectedManifestHash: string;
  }
): Promise<
  Result<
    {
      pass: SupporterPassEntity;
      split: { sellerPayout: string; artistFee: string; platformFee: string };
      unsignedTx: UnsignedChainTransaction;
    },
    Error
  >
> {
  const pass = await repo.getPassById(params.passId);
  if (!pass) return err(new Error("Supporter pass not found"));
  if (pass.status !== "LISTED" || !pass.listingPriceSmallestUnits) {
    return err(new Error("Pass is not currently listed for sale"));
  }
  if (pass.ownerUserId === params.buyerUserId || pass.ownerWallet === params.buyerWallet) {
    return err(new Error("Self-trade by the same owner/wallet is prohibited"));
  }
  if (pass.nonce !== params.expectedNonce) {
    return err(new Error("Listing nonce mismatch (stale listing)"));
  }
  if (pass.listingExpiry && pass.listingExpiry.getTime() <= clock.now().getTime()) {
    return err(new Error("Pass listing has expired"));
  }

  const series = await repo.getSeriesById(pass.seriesId);
  if (!series || series.expiry.getTime() <= clock.now().getTime()) {
    return err(new Error("Pass series has expired"));
  }

  const passport = await repo.getTrackPassport(pass.trackId);
  const eligible = assertPassportEligibleForCommerce(
    passport,
    params.expectedVersion,
    params.expectedManifestHash
  );
  if (!eligible.ok) return eligible;

  const split = computeSecondaryResaleSplit(BigInt(pass.listingPriceSmallestUnits));
  const unsignedTx = await chain.buildListingPurchaseTx({
    buyerWallet: params.buyerWallet,
    sellerWallet: pass.ownerWallet,
    artistWallet: series.artistWallet,
    trackId: pass.trackId,
    seriesId: pass.seriesId,
    serial: pass.serial,
    passId: pass.id,
    nonce: pass.nonce,
    version: eligible.value.currentVersion,
    manifestHash: eligible.value.manifestHash,
    amountSmallestUnits: pass.listingPriceSmallestUnits
  });

  return ok({
    pass,
    split: {
      sellerPayout: split.sellerPayout.toString(),
      artistFee: split.artistFee.toString(),
      platformFee: split.platformFee.toString()
    },
    unsignedTx
  });
}

export async function redeemSupporterPass(
  repo: MarketplaceRepositoryPort,
  clock: ClockPort,
  params: { actorUserId: string; passId: string }
): Promise<Result<{ pass: SupporterPassEntity; deliverableUrl: string }, Error>> {
  const pass = await repo.getPassById(params.passId);
  if (!pass) return err(new Error("Supporter pass not found"));
  if (pass.ownerUserId !== params.actorUserId) {
    return err(new Error("Only the pass owner can redeem this pass"));
  }
  if (pass.status === "REDEEMED" || pass.status === "EXPIRED") {
    return err(new Error(`Pass is already in terminal state (${pass.status})`));
  }
  const series = await repo.getSeriesById(pass.seriesId);
  if (!series) return err(new Error("Pass series not found"));
  if (series.expiry.getTime() <= clock.now().getTime()) {
    return err(new Error("Pass has expired and cannot be redeemed"));
  }

  const redeemed = await repo.savePass({
    ...pass,
    status: "REDEEMED",
    nonce: pass.nonce + 1,
    listingPriceSmallestUnits: null,
    listingExpiry: null
  });

  return ok({ pass: redeemed, deliverableUrl: series.deliverableUrl });
}

// Layer 2 (Devnet / Demo Scope Only)

export async function pledgeToCampaign(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: {
    campaignId: string;
    userId: string;
    payerWallet: string;
    amountSmallestUnits: string;
  }
): Promise<
  Result<
    {
      campaign: CampaignEntity;
      amountSmallestUnits: string;
      unsignedTx: UnsignedChainTransaction;
      settlementStatus: "pending_signature";
    },
    Error
  >
> {
  const campaign = await repo.getCampaignById(params.campaignId);
  if (!campaign) return err(new Error("Campaign not found"));
  if (campaign.status !== "FUNDING") return err(new Error("Campaign is no longer accepting pledges"));
  if (campaign.deadline.getTime() <= clock.now().getTime()) {
    return err(new Error("Campaign deadline has passed"));
  }
  const nonce = new DataView(crypto.getRandomValues(new Uint8Array(8)).buffer).getBigUint64(0).toString();
  const unsignedTx = await chain.buildCampaignPledgeTx({
    payerWallet: params.payerWallet,
    artistWallet: campaign.artistWallet,
    vaultAddress: campaign.vaultAddress,
    campaignId: campaign.id,
    nonce,
    amountSmallestUnits: params.amountSmallestUnits
  });
  return ok({
    campaign,
    nonce,
    amountSmallestUnits: params.amountSmallestUnits,
    unsignedTx,
    settlementStatus: "pending_signature"
  });
}

export async function refundFailedCampaign(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: { campaignId: string; userId: string; claimerWallet: string }
): Promise<
  Result<
    {
      campaign: CampaignEntity;
      refundedAmountSmallestUnits: string;
      unsignedTx: UnsignedChainTransaction;
      settlementStatus: "pending_signature";
    },
    Error
  >
> {
  const campaign = await repo.getCampaignById(params.campaignId);
  if (!campaign) return err(new Error("Campaign not found"));
  const pastDeadlineUnfunded =
    campaign.deadline.getTime() <= clock.now().getTime() &&
    BigInt(campaign.raisedSmallestUnits) < BigInt(campaign.goalSmallestUnits);
  if (campaign.status !== "FAILED" && !pastDeadlineUnfunded) {
    return err(new Error("Refunds are only available for failed campaigns"));
  }
  const amount = await repo.getCampaignPledgeAmount(params.campaignId, params.userId);
  if (BigInt(amount) <= 0n) return err(new Error("No refundable pledge found"));

  const unsignedTx = await chain.buildCampaignRefundTx({
    claimerWallet: params.claimerWallet,
    artistWallet: campaign.artistWallet,
    vaultAddress: campaign.vaultAddress,
    campaignId: campaign.id,
    amountSmallestUnits: amount
  });
  return ok({
    campaign,
    refundedAmountSmallestUnits: amount,
    unsignedTx,
    settlementStatus: "pending_signature"
  });
}

export async function buySpotShareUnits(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  params: {
    spotListingId: string;
    buyerUserId: string;
    buyerWallet: string;
    units: number;
  }
): Promise<
  Result<
    {
      spotListing: SpotListingEntity;
      units: number;
      totalSmallestUnits: string;
      unsignedTx: UnsignedChainTransaction;
      settlementStatus: "pending_signature";
    },
    Error
  >
> {
  const listing = await repo.getSpotListingById(params.spotListingId);
  if (!listing || !listing.active) return err(new Error("Spot listing not active"));
  if (listing.sellerUserId === params.buyerUserId) {
    return err(new Error("Self-trade is prohibited"));
  }
  if (params.units <= 0 || params.units > listing.remainingUnits) {
    return err(new Error("Requested units exceed available ask size"));
  }
  const campaign = await repo.getCampaignById(listing.campaignId);
  const totalSmallestUnits = (
    BigInt(listing.unitPriceSmallestUnits) * BigInt(params.units)
  ).toString();
  const unsignedTx = await chain.buildSpotBuyTx({
    buyerWallet: params.buyerWallet,
    sellerWallet: listing.sellerWallet,
    artistWallet: campaign?.artistWallet,
    spotListingId: listing.id,
    campaignId: listing.campaignId,
    units: params.units,
    expectedNonce: listing.nonce ?? 0,
    unitPriceSmallestUnits: listing.unitPriceSmallestUnits,
    totalSmallestUnits
  });
  return ok({
    spotListing: listing,
    units: params.units,
    totalSmallestUnits,
    unsignedTx,
    settlementStatus: "pending_signature"
  });
}

export async function claimDistributionPayout(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  params: { cycleId: string; userId: string; claimerWallet: string }
): Promise<
  Result<
    {
      cycle: DistributionCycleEntity;
      payoutSmallestUnits: string;
      unsignedTx: UnsignedChainTransaction;
      settlementStatus: "pending_signature";
    },
    Error
  >
> {
  const cycle = await repo.getDistributionCycleById(params.cycleId);
  if (!cycle) return err(new Error("Distribution cycle not found"));

  const approval = await repo.getDistributionApproval(cycle.id);
  if (!approval || approval.status !== "FUNDED_AND_OPEN") {
    return err(new Error("Distribution cycle is not funded and open for claims"));
  }

  const campaign = await repo.getCampaignById(cycle.campaignId);
  if (!campaign) return err(new Error("Campaign not found for distribution cycle"));

  const holderUnits = await repo.getHolderShareUnitsAtRecordDate(
    cycle.id,
    cycle.campaignId,
    params.userId,
    cycle.recordDate
  );
  if (holderUnits <= 0) {
    return err(new Error("No eligible project share units held at record date"));
  }

  const payout = computeProRataDistributionClaim({
    verifiedRevenue: BigInt(cycle.verifiedRevenueSmallestUnits),
    totalClaimedSoFar: BigInt(cycle.claimedSmallestUnits),
    holderUnits: BigInt(holderUnits),
    totalSupplySnapshot: BigInt(cycle.totalSupplySnapshot)
  });
  if (payout <= 0n) return err(new Error("No remaining claimable payout in cycle"));

  let entitlements: Array<{ claimerWallet: string; amountSmallestUnits: string }> | undefined;
  if (repo.listDistributionEntitlements) {
    const holders = await repo.listDistributionEntitlements(cycle.id);
    if (holders.length > 0) {
      entitlements = holders.map((h) => ({
        claimerWallet: h.walletAddress,
        amountSmallestUnits: (
          (BigInt(cycle.verifiedRevenueSmallestUnits) * BigInt(h.units)) /
          BigInt(cycle.totalSupplySnapshot)
        ).toString()
      }));
    }
  }

  const unsignedTx = await chain.buildDistributionClaimTx({
    claimerWallet: params.claimerWallet,
    artistWallet: campaign.artistWallet,
    vaultAddress: campaign.vaultAddress,
    cycleId: cycle.id,
    campaignId: cycle.campaignId,
    payoutSmallestUnits: payout.toString(),
    entitlements
  });

  return ok({
    cycle,
    payoutSmallestUnits: payout.toString(),
    unsignedTx,
    settlementStatus: "pending_signature"
  });
}

export async function tradeOpinionMarketPair(
  repo: MarketplaceRepositoryPort,
  clock: ClockPort,
  params: { marketId: string; userId: string; side: "YES" | "NO"; pairsCount: number }
): Promise<Result<OpinionMarketEntity, Error>> {
  const market = await repo.getOpinionMarketById(params.marketId);
  if (!market) return err(new Error("Opinion market not found"));
  if (market.resolvedOutcome !== "UNRESOLVED") {
    return err(new Error("Opinion market is already resolved"));
  }
  if (clock.now().getTime() >= market.tradingCutoff.getTime()) {
    return err(new Error("Opinion market trading cutoff has passed"));
  }
  if (market.tradingCutoff.getTime() >= market.campaignDeadline.getTime()) {
    return err(new Error("Invalid market configuration: cutoff must precede campaign deadline"));
  }
  const updated = await repo.recordOpinionTrade(params);
  return ok(updated);
}

export async function cancelPassListing(
  repo: MarketplaceRepositoryPort,
  params: { passId: string; userId: string }
): Promise<Result<SupporterPassEntity, Error>> {
  const pass = await repo.getPassById(params.passId);
  if (!pass) return err(new Error("Pass not found"));
  if (pass.ownerUserId !== params.userId) {
    return err(new Error("Only the pass owner can cancel this listing"));
  }
  if (pass.status !== "LISTED") {
    return err(new Error(`Pass in status ${pass.status} cannot be cancelled`));
  }
  const updated = await repo.savePass({
    ...pass,
    status: "OWNED",
    nonce: pass.nonce + 1,
    listingPriceSmallestUnits: null,
    listingExpiry: null
  });
  return ok(updated);
}

export async function cancelSpotListing(
  repo: MarketplaceRepositoryPort,
  params: { spotListingId: string; userId: string }
): Promise<Result<SpotListingEntity, Error>> {
  const listing = await repo.getSpotListingById(params.spotListingId);
  if (!listing) return err(new Error("Spot listing not found"));
  if (listing.sellerUserId !== params.userId) {
    return err(new Error("Only the seller can cancel this spot listing"));
  }
  if (!listing.active) {
    return err(new Error("Spot listing is already inactive"));
  }
  const updated = await repo.saveSpotListing({
    ...listing,
    active: false
  });
  return ok(updated);
}

export async function refundCampaign(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: { campaignId: string; userId: string; claimerWallet: string }
): Promise<
  Result<
    {
      campaign: CampaignEntity;
      refundSmallestUnits: string;
      unsignedTx: UnsignedChainTransaction;
      settlementStatus: "pending_signature";
    },
    Error
  >
> {
  const res = await refundFailedCampaign(repo, chain, clock, params);
  if (!res.ok) return res;
  return ok({
    campaign: res.value.campaign,
    refundSmallestUnits: res.value.refundedAmountSmallestUnits,
    unsignedTx: res.value.unsignedTx,
    settlementStatus: res.value.settlementStatus
  });
}

export async function reviewCampaign(
  repo: MarketplaceRepositoryPort,
  clock: ClockPort,
  params: {
    campaignId: string;
    reviewerUserId: string;
    decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
    notes: string;
    termsHash?: string;
  }
): Promise<Result<CampaignReviewEntity, Error>> {
  const campaign = await repo.getCampaignById(params.campaignId);
  if (!campaign) return err(new Error("Campaign not found"));
  if (campaign.artistUserId === params.reviewerUserId) {
    return err(new Error("Artist cannot review their own campaign"));
  }
  const review = await repo.recordCampaignReview({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    reviewerUserId: params.reviewerUserId,
    decision: params.decision,
    notes: params.notes,
    termsHash: params.termsHash ?? null,
    createdAt: clock.now()
  });
  return ok(review);
}

export async function submitMilestoneEvidence(
  repo: MarketplaceRepositoryPort,
  clock: ClockPort,
  params: { milestoneId: string; artistUserId: string; evidenceUri: string }
): Promise<Result<CampaignMilestoneEntity, Error>> {
  const milestone = await repo.getMilestoneById(params.milestoneId);
  if (!milestone) return err(new Error("Milestone not found"));
  const campaign = await repo.getCampaignById(milestone.campaignId);
  if (!campaign || campaign.artistUserId !== params.artistUserId) {
    return err(new Error("Only the campaign artist can submit milestone evidence"));
  }
  if (milestone.status === "APPROVED" || milestone.status === "RELEASED") {
    return err(new Error(`Milestone in status ${milestone.status} cannot be resubmitted`));
  }
  const updated = await repo.saveMilestone({
    ...milestone,
    evidenceUri: params.evidenceUri,
    status: "SUBMITTED",
    updatedAt: clock.now()
  });
  return ok(updated);
}

export async function approveMilestone(
  repo: MarketplaceRepositoryPort,
  clock: ClockPort,
  params: { milestoneId: string; reviewerUserId: string; approved: boolean }
): Promise<Result<CampaignMilestoneEntity, Error>> {
  const milestone = await repo.getMilestoneById(params.milestoneId);
  if (!milestone) return err(new Error("Milestone not found"));
  if (milestone.status !== "SUBMITTED") {
    return err(new Error("Milestone must be SUBMITTED before review"));
  }
  const campaign = await repo.getCampaignById(milestone.campaignId);
  if (campaign && campaign.artistUserId === params.reviewerUserId) {
    return err(new Error("Artist cannot approve their own milestone"));
  }
  const updated = await repo.saveMilestone({
    ...milestone,
    status: params.approved ? "APPROVED" : "REJECTED",
    reviewerUserId: params.reviewerUserId,
    updatedAt: clock.now()
  });
  return ok(updated);
}

export async function reconcileDistributionCycle(
  repo: MarketplaceRepositoryPort,
  clock: ClockPort,
  params: {
    cycleId: string;
    operatorUserId: string;
    evidenceHash: string;
    verifiedRevenueSmallestUnits: string;
  }
): Promise<Result<DistributionApprovalEntity, Error>> {
  const cycle = await repo.getDistributionCycleById(params.cycleId);
  if (!cycle) return err(new Error("Distribution cycle not found"));
  await repo.saveDistributionCycle({
    ...cycle,
    verifiedRevenueSmallestUnits: params.verifiedRevenueSmallestUnits
  });
  const approval = await repo.saveDistributionApproval({
    cycleId: cycle.id,
    operatorUserId: params.operatorUserId,
    approverUserId: null,
    evidenceHash: params.evidenceHash,
    reconciledAt: clock.now(),
    approvedAt: null,
    fundedTxSig: null,
    status: "RECONCILED"
  });
  return ok(approval);
}

export async function approveAndFundDistributionCycle(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: {
    cycleId: string;
    approverUserId: string;
    fundedTxSig: string;
  }
): Promise<Result<DistributionApprovalEntity, Error>> {
  const cycle = await repo.getDistributionCycleById(params.cycleId);
  if (!cycle) return err(new Error("Distribution cycle not found"));
  const campaign = await repo.getCampaignById(cycle.campaignId);
  if (!campaign) return err(new Error("Campaign not found for distribution cycle"));

  const approval = await repo.getDistributionApproval(params.cycleId);
  if (!approval) return err(new Error("Distribution cycle has not been reconciled yet"));
  if (approval.operatorUserId === params.approverUserId) {
    return err(new Error("Dual approval required: approver must differ from operator"));
  }
  if (approval.status === "FUNDED_AND_OPEN") {
    return err(new Error("Distribution cycle is already funded and open"));
  }

  const verification = await chain.verifyFinalizedDeposit({
    signature: params.fundedTxSig,
    expectedDestination: campaign.vaultAddress,
    minimumAmountSmallestUnits: cycle.verifiedRevenueSmallestUnits
  });
  if (!verification.verified) {
    return err(
      new Error(
        verification.reason ??
        "On-chain deposit could not be verified as finalized for the cycle vault"
      )
    );
  }

  await repo.snapshotCycleHolders(cycle.id, cycle.campaignId, cycle.recordDate);

  const updated = await repo.saveDistributionApproval({
    ...approval,
    approverUserId: params.approverUserId,
    approvedAt: clock.now(),
    fundedTxSig: params.fundedTxSig,
    status: "FUNDED_AND_OPEN"
  });
  return ok(updated);
}

export function aggregateSpotCandles(
  fills: readonly SpotFillEntity[],
  bucketMinutes = 60
): { candles: CandlePoint[]; lastUpdatedAt: string | null } {
  if (fills.length === 0) {
    return { candles: [], lastUpdatedAt: null };
  }
  const sorted = [...fills].sort((a, b) => a.filledAt.getTime() - b.filledAt.getTime());
  const bucketMs = Math.max(1, bucketMinutes) * 60_000;
  const buckets = new Map<number, SpotFillEntity[]>();

  for (const fill of sorted) {
    const bucketKey = Math.floor(fill.filledAt.getTime() / bucketMs) * bucketMs;
    const list = buckets.get(bucketKey) ?? [];
    list.push(fill);
    buckets.set(bucketKey, list);
  }

  const candles: CandlePoint[] = [];
  for (const [bucketStart, bucketFills] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
    const prices = bucketFills.map((f) => Number(f.unitPriceSmallestUnits) / 1_000_000);
    const open = prices[0]!;
    const close = prices[prices.length - 1]!;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const iso = new Date(bucketStart).toISOString();
    candles.push({
      time: `${iso.slice(11, 16)} UTC`,
      open,
      high,
      low,
      close
    });
  }

  const lastUpdatedAt = sorted[sorted.length - 1]!.filledAt.toISOString();
  return { candles, lastUpdatedAt };
}
