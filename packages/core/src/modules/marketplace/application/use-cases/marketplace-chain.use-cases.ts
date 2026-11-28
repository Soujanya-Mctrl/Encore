import type { ConfirmMarketplaceTxInput } from "@encore/contracts";
import { err, ok, type Result } from "../../../../kernel/result.js";
import type { ClockPort } from "../../../../kernel/ports.js";
import type {
  CampaignEntity,
  CampaignMilestoneEntity,
  PassSeriesEntity,
  SpotListingEntity,
  SupportReceiptEntity,
  SupporterPassEntity
} from "../../domain/marketplace.entities.js";
import type {
  MarketplaceChainPort,
  MarketplaceRepositoryPort,
  UnsignedChainTransaction
} from "../ports/marketplace.ports.js";
import { assertPassportEligibleForCommerce } from "./marketplace.use-cases.js";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function prepareCreatePassSeries(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: {
    artistUserId: string;
    artistWallet: string;
    trackId: string;
    title: string;
    benefitSummary: string;
    cap: number;
    primaryPriceSmallestUnits: string;
    expiry: Date;
    deliverableUrl: string;
  }
): Promise<
  Result<
    {
      seriesId: string;
      unsignedTx: UnsignedChainTransaction;
      termsHash: string;
      benefitHash: string;
    },
    Error
  >
> {
  if (!chain.buildCreateSeriesTx) {
    return err(new Error("Chain adapter does not support create_series"));
  }
  const passport = await repo.getTrackPassport(params.trackId);
  if (!passport) return err(new Error("Track passport not found"));
  if (passport.paused) return err(new Error("Track is paused"));
  if (params.expiry.getTime() <= clock.now().getTime()) {
    return err(new Error("Series expiry must be in the future"));
  }

  const seriesId = crypto.randomUUID();
  const termsHash = await sha256Hex(`${params.trackId}:${params.title}:${params.cap}:${params.primaryPriceSmallestUnits}`);
  const benefitHash = await sha256Hex(`${params.benefitSummary}:${params.deliverableUrl}`);
  const unsignedTx = await chain.buildCreateSeriesTx({
    artistWallet: params.artistWallet,
    trackId: params.trackId,
    seriesId,
    termsHash,
    benefitHash,
    cap: params.cap,
    primaryPriceSmallestUnits: params.primaryPriceSmallestUnits,
    expiryUnixSeconds: Math.floor(params.expiry.getTime() / 1000)
  });

  return ok({ seriesId, unsignedTx, termsHash, benefitHash });
}

export async function prepareListOwnedPass(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: {
    actorUserId: string;
    actorWallet: string;
    passId: string;
    listingPriceSmallestUnits: string;
    listingExpiry: Date;
  }
): Promise<Result<{ pass: SupporterPassEntity; unsignedTx: UnsignedChainTransaction }, Error>> {
  if (!chain.buildListPassTx) {
    return err(new Error("Chain adapter does not support list_pass"));
  }
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
  if (
    params.listingExpiry.getTime() <= clock.now().getTime() ||
    params.listingExpiry.getTime() > series.expiry.getTime()
  ) {
    return err(new Error("Listing expiry must be between now and series expiry"));
  }

  const unsignedTx = await chain.buildListPassTx({
    ownerWallet: params.actorWallet,
    artistWallet: series.artistWallet,
    trackId: pass.trackId,
    seriesId: pass.seriesId,
    serial: pass.serial,
    listingPriceSmallestUnits: params.listingPriceSmallestUnits,
    listingExpiryUnixSeconds: Math.floor(params.listingExpiry.getTime() / 1000)
  });

  return ok({ pass, unsignedTx });
}

export async function prepareCancelPassListing(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  params: { actorUserId: string; actorWallet: string; passId: string }
): Promise<Result<{ pass: SupporterPassEntity; unsignedTx: UnsignedChainTransaction }, Error>> {
  if (!chain.buildCancelPassListingTx) {
    return err(new Error("Chain adapter does not support cancel_pass_listing"));
  }
  const pass = await repo.getPassById(params.passId);
  if (!pass) return err(new Error("Pass not found"));
  if (pass.ownerUserId !== params.actorUserId) {
    return err(new Error("Only the pass owner can cancel this listing"));
  }
  if (pass.status !== "LISTED") {
    return err(new Error(`Pass in status ${pass.status} cannot be cancelled`));
  }
  const series = await repo.getSeriesById(pass.seriesId);
  if (!series) return err(new Error("Pass series not found"));

  const unsignedTx = await chain.buildCancelPassListingTx({
    ownerWallet: params.actorWallet,
    artistWallet: series.artistWallet,
    seriesId: pass.seriesId,
    serial: pass.serial
  });
  return ok({ pass, unsignedTx });
}

export async function prepareRedeemSupporterPass(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: { actorUserId: string; actorWallet: string; passId: string }
): Promise<Result<{ pass: SupporterPassEntity; unsignedTx: UnsignedChainTransaction }, Error>> {
  if (!chain.buildRedeemPassTx) {
    return err(new Error("Chain adapter does not support redeem_pass"));
  }
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

  const unsignedTx = await chain.buildRedeemPassTx({
    ownerWallet: params.actorWallet,
    artistWallet: series.artistWallet,
    seriesId: pass.seriesId,
    serial: pass.serial
  });
  return ok({ pass, unsignedTx });
}

export async function prepareCreateCampaign(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: {
    artistWallet: string;
    trackId: string;
    title: string;
    goalSmallestUnits: string;
    shareSupply: number;
    deadline: Date;
    useOfFunds: string;
    rightsScope: string;
  }
): Promise<
  Result<
    {
      campaignId: string;
      vaultAddress: string;
      termsHash: string;
      unsignedTx: UnsignedChainTransaction;
    },
    Error
  >
> {
  if (!chain.buildCreateCampaignTx) {
    return err(new Error("Chain adapter does not support create_campaign"));
  }
  const passport = await repo.getTrackPassport(params.trackId);
  if (!passport) return err(new Error("Track passport not found"));
  if (passport.paused) return err(new Error("Track is paused"));
  if (params.deadline.getTime() <= clock.now().getTime()) {
    return err(new Error("Campaign deadline must be in the future"));
  }

  const campaignId = crypto.randomUUID();
  const termsHash = await sha256Hex(
    `${params.trackId}:${params.title}:${params.goalSmallestUnits}:${params.shareSupply}:${params.rightsScope}`
  );
  const unsignedTx = await chain.buildCreateCampaignTx({
    artistWallet: params.artistWallet,
    trackId: params.trackId,
    campaignId,
    termsHash,
    goalSmallestUnits: params.goalSmallestUnits,
    shareSupply: params.shareSupply,
    deadlineUnixSeconds: Math.floor(params.deadline.getTime() / 1000)
  });

  return ok({
    campaignId,
    vaultAddress: unsignedTx.accounts?.campaignVault ?? "",
    termsHash,
    unsignedTx
  });
}

export async function prepareReleaseCampaignMilestone(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  params: { actorUserId: string; artistWallet: string; milestoneId: string }
): Promise<Result<{ milestone: CampaignMilestoneEntity; unsignedTx: UnsignedChainTransaction }, Error>> {
  if (!chain.buildReleaseMilestoneTx) {
    return err(new Error("Chain adapter does not support release_milestone"));
  }
  const milestone = await repo.getMilestoneById(params.milestoneId);
  if (!milestone) return err(new Error("Milestone not found"));
  if (milestone.status !== "APPROVED") {
    return err(new Error("Milestone must be APPROVED before releasing funds"));
  }
  const campaign = await repo.getCampaignById(milestone.campaignId);
  if (!campaign) return err(new Error("Campaign not found"));
  if (campaign.artistUserId !== params.actorUserId) {
    return err(new Error("Only the campaign artist can release milestone funds"));
  }
  if (campaign.status !== "FUNDED") {
    return err(new Error("Campaign must be FUNDED before releasing milestones"));
  }

  const unsignedTx = await chain.buildReleaseMilestoneTx({
    artistWallet: params.artistWallet,
    campaignId: campaign.id,
    vaultAddress: campaign.vaultAddress,
    milestoneIndex: milestone.sequenceIndex,
    amountSmallestUnits: milestone.releaseAmountSmallestUnits
  });
  return ok({ milestone, unsignedTx });
}

export async function prepareCreateSpotListing(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  params: {
    sellerUserId: string;
    sellerWallet: string;
    campaignId: string;
    units: number;
    unitPriceSmallestUnits: string;
  }
): Promise<Result<{ spotListingId: string; unsignedTx: UnsignedChainTransaction }, Error>> {
  if (!chain.buildCreateSpotListingTx) {
    return err(new Error("Chain adapter does not support create_spot_listing"));
  }
  const campaign = await repo.getCampaignById(params.campaignId);
  if (!campaign) return err(new Error("Campaign not found"));
  if (campaign.status !== "FUNDED") {
    return err(new Error("Campaign must be FUNDED before listing project shares"));
  }
  const spotListingId = crypto.randomUUID();
  const unsignedTx = await chain.buildCreateSpotListingTx({
    sellerWallet: params.sellerWallet,
    artistWallet: campaign.artistWallet,
    campaignId: campaign.id,
    spotListingId,
    units: params.units,
    unitPriceSmallestUnits: params.unitPriceSmallestUnits
  });
  return ok({ spotListingId, unsignedTx });
}

export async function prepareCancelSpotListing(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  params: { sellerUserId: string; sellerWallet: string; spotListingId: string }
): Promise<Result<{ listing: SpotListingEntity; unsignedTx: UnsignedChainTransaction }, Error>> {
  if (!chain.buildCancelSpotListingTx) {
    return err(new Error("Chain adapter does not support cancel_spot_listing"));
  }
  const listing = await repo.getSpotListingById(params.spotListingId);
  if (!listing) return err(new Error("Spot listing not found"));
  if (listing.sellerUserId !== params.sellerUserId) {
    return err(new Error("Only the seller can cancel this spot listing"));
  }
  if (!listing.active) return err(new Error("Spot listing is already inactive"));
  const campaign = await repo.getCampaignById(listing.campaignId);
  if (!campaign) return err(new Error("Campaign not found"));

  const unsignedTx = await chain.buildCancelSpotListingTx({
    sellerWallet: params.sellerWallet,
    artistWallet: campaign.artistWallet,
    campaignId: listing.campaignId,
    spotListingId: listing.id
  });
  return ok({ listing, unsignedTx });
}

export async function prepareOpenDistributionCycle(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  params: { authorityWallet: string; cycleId: string }
): Promise<Result<{ cycleId: string; unsignedTx: UnsignedChainTransaction }, Error>> {
  if (!chain.buildOpenDistributionCycleTx) {
    return err(new Error("Chain adapter does not support open_distribution_cycle"));
  }
  const cycle = await repo.getDistributionCycleById(params.cycleId);
  if (!cycle) return err(new Error("Distribution cycle not found"));
  const campaign = await repo.getCampaignById(cycle.campaignId);
  if (!campaign) return err(new Error("Campaign not found"));
  const approval = await repo.getDistributionApproval(cycle.id);
  if (!approval) return err(new Error("Distribution cycle must be reconciled first"));

  await repo.snapshotCycleHolders(cycle.id, cycle.campaignId, cycle.recordDate);
  const holders = repo.listDistributionEntitlements
    ? await repo.listDistributionEntitlements(cycle.id)
    : [];
  const entitlements = holders
    .map((h) => ({
      claimerWallet: h.walletAddress,
      amountSmallestUnits: (
        (BigInt(cycle.verifiedRevenueSmallestUnits) * BigInt(h.units)) /
        BigInt(cycle.totalSupplySnapshot)
      ).toString()
    }))
    .filter((e) => BigInt(e.amountSmallestUnits) > 0n);

  const unsignedTx = await chain.buildOpenDistributionCycleTx({
    authorityWallet: params.authorityWallet,
    artistWallet: campaign.artistWallet,
    campaignId: campaign.id,
    cycleId: cycle.id,
    evidenceHash: approval.evidenceHash,
    entitlements,
    verifiedRevenueSmallestUnits: cycle.verifiedRevenueSmallestUnits,
    totalSupplySnapshot: cycle.totalSupplySnapshot
  });

  return ok({ cycleId: cycle.id, unsignedTx });
}

export async function confirmMarketplaceSettlement(
  repo: MarketplaceRepositoryPort,
  chain: MarketplaceChainPort,
  clock: ClockPort,
  params: {
    actorUserId: string;
    actorWallet: string;
    cluster: string;
    input: ConfirmMarketplaceTxInput;
  }
): Promise<
  Result<
    {
      confirmed: true;
      signature: string;
      slot: number;
      explorerUrl: string;
      receipt?: SupportReceiptEntity;
      series?: PassSeriesEntity;
      pass?: SupporterPassEntity;
      campaign?: CampaignEntity;
      spotListing?: SpotListingEntity;
      deliverableUrl?: string;
    },
    Error
  >
> {
  if (!chain.verifyFinalizedMarketplaceTx) {
    return err(new Error("Chain adapter does not support finalized verification"));
  }

  let signature = params.input.signature;
  if (!signature && params.input.signedTransaction) {
    if (!chain.submitSignedTransaction) {
      return err(new Error("Chain adapter cannot submit signed transactions"));
    }
    const submitted = await chain.submitSignedTransaction(params.input.signedTransaction);
    signature = submitted.signature;
  }
  if (!signature) {
    return err(new Error("Finalized transaction signature is required"));
  }

  const verification = await chain.verifyFinalizedMarketplaceTx({
    signature,
    expectedInstruction: params.input.kind,
    expectedSigner: params.actorWallet
  });
  if (!verification.verified) {
    return err(
      new Error(verification.reason ?? "Transaction is not finalized on Solana")
    );
  }

  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${params.cluster}`;
  if (repo.recordChainEvent) {
    await repo.recordChainEvent({
      signature,
      eventIndex: 0,
      slot: verification.slot,
      eventType: params.input.kind,
      payload: {
        kind: params.input.kind,
        actorWallet: params.actorWallet,
        events: verification.events
      },
      finality: "finalized"
    });
  }

  const { input } = params;
  switch (input.kind) {
    case "direct_support": {
      const existing = await repo.getReceiptBySignature(signature);
      if (existing) {
        return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, receipt: existing });
      }
      if (!input.trackId || !input.amountSmallestUnits) {
        return err(new Error("trackId and amountSmallestUnits required to confirm direct_support"));
      }
      const passport = await repo.getTrackPassport(input.trackId);
      const eligible = assertPassportEligibleForCommerce(
        passport,
        input.expectedVersion ?? passport?.currentVersion ?? 1,
        input.expectedManifestHash ?? passport?.manifestHash ?? ""
      );
      if (!eligible.ok) return eligible;

      const receipt = await repo.recordSupportReceipt({
        id: crypto.randomUUID(),
        payerUserId: params.actorUserId,
        payerWallet: params.actorWallet,
        trackId: input.trackId,
        passportVersion: eligible.value.currentVersion,
        manifestHash: eligible.value.manifestHash,
        amountSmallestUnits: input.amountSmallestUnits,
        artistWallet: eligible.value.artistWallet,
        signature,
        walletMode: input.walletMode ?? "external_anchor",
        createdAt: clock.now()
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, receipt });
    }

    case "create_series": {
      if (
        !input.seriesId ||
        !input.trackId ||
        !input.title ||
        !input.benefitSummary ||
        !input.cap ||
        !input.primaryPriceSmallestUnits ||
        !input.expiryIso ||
        !input.deliverableUrl
      ) {
        return err(new Error("Complete series fields required to confirm create_series"));
      }
      const existing = await repo.getSeriesById(input.seriesId);
      if (existing) {
        return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, series: existing });
      }
      const series = await repo.createSeries({
        id: input.seriesId,
        trackId: input.trackId,
        artistUserId: params.actorUserId,
        artistWallet: params.actorWallet,
        title: input.title,
        benefitSummary: input.benefitSummary,
        cap: input.cap,
        issued: 0,
        primaryPriceSmallestUnits: input.primaryPriceSmallestUnits,
        expiry: new Date(input.expiryIso),
        status: "ACTIVE",
        deliverableUrl: input.deliverableUrl
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, series });
    }

    case "buy_primary": {
      if (!input.seriesId) return err(new Error("seriesId required"));
      const existingReceipt = await repo.getReceiptBySignature(signature);
      const series = await repo.getSeriesById(input.seriesId);
      if (!series) return err(new Error("Pass series not found"));
      if (existingReceipt && input.passId) {
        const existingPass = await repo.getPassById(input.passId);
        return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, pass: existingPass ?? undefined });
      }
      const updatedSeries = await repo.incrementSeriesIssued(series.id);
      const pass = await repo.savePass({
        id: input.passId ?? `${series.id}-pass-${updatedSeries.issued}`,
        seriesId: series.id,
        trackId: series.trackId,
        serial: updatedSeries.issued,
        ownerUserId: params.actorUserId,
        ownerWallet: params.actorWallet,
        status: "OWNED",
        nonce: 0,
        listingPriceSmallestUnits: null,
        listingExpiry: null
      });
      await repo.recordSupportReceipt({
        id: crypto.randomUUID(),
        payerUserId: params.actorUserId,
        payerWallet: params.actorWallet,
        trackId: series.trackId,
        passportVersion: input.expectedVersion ?? 1,
        manifestHash: input.expectedManifestHash ?? "0".repeat(64),
        amountSmallestUnits: series.primaryPriceSmallestUnits,
        artistWallet: series.artistWallet,
        signature,
        walletMode: input.walletMode ?? "external_anchor",
        createdAt: clock.now()
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, pass });
    }

    case "list_pass": {
      if (!input.passId || !input.listingPriceSmallestUnits || !input.listingExpiryIso) {
        return err(new Error("passId, listingPriceSmallestUnits, listingExpiryIso required"));
      }
      const pass = await repo.getPassById(input.passId);
      if (!pass) return err(new Error("Pass not found"));
      if (pass.ownerUserId !== params.actorUserId) {
        return err(new Error("Only the pass owner can confirm listing"));
      }
      const updated = await repo.savePass({
        ...pass,
        status: "LISTED",
        nonce: pass.nonce + 1,
        listingPriceSmallestUnits: input.listingPriceSmallestUnits,
        listingExpiry: new Date(input.listingExpiryIso)
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, pass: updated });
    }

    case "cancel_pass_listing": {
      if (!input.passId) return err(new Error("passId required"));
      const pass = await repo.getPassById(input.passId);
      if (!pass) return err(new Error("Pass not found"));
      if (pass.ownerUserId !== params.actorUserId) {
        return err(new Error("Only the pass owner can confirm cancellation"));
      }
      const updated = await repo.savePass({
        ...pass,
        status: "OWNED",
        nonce: pass.nonce + 1,
        listingPriceSmallestUnits: null,
        listingExpiry: null
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, pass: updated });
    }

    case "buy_listing": {
      if (!input.passId) return err(new Error("passId required"));
      const pass = await repo.getPassById(input.passId);
      if (!pass) return err(new Error("Pass not found"));
      if (pass.ownerUserId === params.actorUserId) {
        return err(new Error("Self-trade is prohibited"));
      }
      const series = await repo.getSeriesById(pass.seriesId);
      const updated = await repo.savePass({
        ...pass,
        ownerUserId: params.actorUserId,
        ownerWallet: params.actorWallet,
        status: "OWNED",
        nonce: pass.nonce + 1,
        listingPriceSmallestUnits: null,
        listingExpiry: null
      });
      if (series && pass.listingPriceSmallestUnits) {
        await repo.recordSupportReceipt({
          id: crypto.randomUUID(),
          payerUserId: params.actorUserId,
          payerWallet: params.actorWallet,
          trackId: pass.trackId,
          passportVersion: input.expectedVersion ?? 1,
          manifestHash: input.expectedManifestHash ?? "0".repeat(64),
          amountSmallestUnits: pass.listingPriceSmallestUnits,
          artistWallet: series.artistWallet,
          signature,
          walletMode: input.walletMode ?? "external_anchor",
          createdAt: clock.now()
        });
      }
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, pass: updated });
    }

    case "redeem_pass": {
      if (!input.passId) return err(new Error("passId required"));
      const pass = await repo.getPassById(input.passId);
      if (!pass) return err(new Error("Pass not found"));
      if (pass.ownerUserId !== params.actorUserId) {
        return err(new Error("Only the pass owner can redeem this pass"));
      }
      const series = await repo.getSeriesById(pass.seriesId);
      if (!series) return err(new Error("Pass series not found"));
      const updated = await repo.savePass({
        ...pass,
        status: "REDEEMED",
        nonce: pass.nonce + 1,
        listingPriceSmallestUnits: null,
        listingExpiry: null
      });
      return ok({
        confirmed: true,
        signature,
        slot: verification.slot,
        explorerUrl,
        pass: updated,
        deliverableUrl: series.deliverableUrl
      });
    }

    case "create_campaign": {
      if (
        !input.campaignId ||
        !input.trackId ||
        !input.title ||
        !input.goalSmallestUnits ||
        !input.shareSupply ||
        !input.deadlineIso ||
        !input.useOfFunds ||
        !input.rightsScope ||
        !repo.saveCampaign
      ) {
        return err(new Error("Complete campaign fields required"));
      }
      const campaign = await repo.saveCampaign({
        id: input.campaignId,
        trackId: input.trackId,
        artistUserId: params.actorUserId,
        artistWallet: params.actorWallet,
        title: input.title,
        goalSmallestUnits: input.goalSmallestUnits,
        raisedSmallestUnits: "0",
        shareSupply: input.shareSupply,
        deadline: new Date(input.deadlineIso),
        useOfFunds: input.useOfFunds,
        rightsScope: input.rightsScope,
        status: "FUNDING",
        vaultAddress: input.vaultAddress ?? input.campaignId
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, campaign });
    }

    case "pledge_campaign": {
      if (!input.campaignId || !input.amountSmallestUnits) {
        return err(new Error("campaignId and amountSmallestUnits required"));
      }
      const campaign = await repo.recordCampaignPledge({
        campaignId: input.campaignId,
        userId: params.actorUserId,
        amountSmallestUnits: input.amountSmallestUnits
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, campaign });
    }

    case "refund_campaign": {
      if (!input.campaignId) return err(new Error("campaignId required"));
      await repo.markCampaignRefundClaimed(input.campaignId, params.actorUserId);
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl });
    }

    case "create_spot_listing": {
      if (
        !input.spotListingId ||
        !input.campaignId ||
        !input.units ||
        !input.unitPriceSmallestUnits
      ) {
        return err(new Error("spotListingId, campaignId, units, unitPriceSmallestUnits required"));
      }
      const spotListing = await repo.saveSpotListing({
        id: input.spotListingId,
        campaignId: input.campaignId,
        sellerUserId: params.actorUserId,
        sellerWallet: params.actorWallet,
        remainingUnits: input.units,
        unitPriceSmallestUnits: input.unitPriceSmallestUnits,
        nonce: 0,
        active: true
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, spotListing });
    }

    case "cancel_spot_listing": {
      if (!input.spotListingId) return err(new Error("spotListingId required"));
      const existing = await repo.getSpotListingById(input.spotListingId);
      if (!existing) return err(new Error("Spot listing not found"));
      if (existing.sellerUserId !== params.actorUserId) {
        return err(new Error("Only the seller can cancel this spot listing"));
      }
      const spotListing = await repo.saveSpotListing({
        ...existing,
        active: false,
        remainingUnits: 0,
        nonce: (existing.nonce ?? 0) + 1
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, spotListing });
    }

    case "buy_spot": {
      if (!input.spotListingId || !input.units) {
        return err(new Error("spotListingId and units required"));
      }
      const spotListing = await repo.fillSpotListing({
        spotListingId: input.spotListingId,
        buyerUserId: params.actorUserId,
        units: input.units
      });
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl, spotListing });
    }

    case "claim_distribution": {
      if (!input.cycleId || !input.amountSmallestUnits) {
        return err(new Error("cycleId and amountSmallestUnits required"));
      }
      await repo.markDistributionClaimed(
        input.cycleId,
        params.actorUserId,
        input.amountSmallestUnits
      );
      return ok({ confirmed: true, signature, slot: verification.slot, explorerUrl });
    }
  }
}
