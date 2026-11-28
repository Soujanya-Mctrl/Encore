import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TrackPassportSummary } from "@encore/contracts";
import {
  aggregateSpotCandles,
  type CampaignEntity,
  type CampaignMilestoneEntity,
  type CampaignReviewEntity,
  type DistributionApprovalEntity,
  type DistributionCycleEntity,
  type MarketplaceRepositoryPort,
  type MarketplaceSnapshot,
  type OpinionMarketEntity,
  type PassSeriesEntity,
  type SpotFillEntity,
  type SpotListingEntity,
  type SupportReceiptEntity,
  type SupporterPassEntity
} from "@encore/core";

export class SupabaseMarketplaceRepository implements MarketplaceRepositoryPort {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  async getMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
    const [tracksRes, seriesRes, listedRes, campaignsRes, spotRes, cyclesRes, marketsRes, fills] =
      await Promise.all([
        this.client.from("tracks").select("*, manifest_versions(*)").eq("publish_state", "published"),
        this.client.from("series").select("*"),
        this.client.from("passes").select("*").eq("status", "LISTED"),
        this.client.from("campaigns").select("*"),
        this.client.from("spot_listings").select("*").eq("active", true),
        this.client.from("distribution_cycles").select("*"),
        this.client.from("opinion_markets").select("*"),
        this.listSpotFills()
      ]);

    const tracks: TrackPassportSummary[] = (tracksRes.data ?? []).map((t: any) => {
      const versions = Array.isArray(t.manifest_versions) ? t.manifest_versions : [];
      const current = versions.find((v: any) => v.version === t.current_version) ?? versions[0];
      return {
        trackId: t.id,
        title: t.title,
        artistName: t.artist_name ?? "Artist",
        artistWallet: t.artist_wallet ?? "11111111111111111111111111111111",
        currentVersion: t.current_version,
        manifestHash: current?.hash ?? "0".repeat(64),
        paused: Boolean(t.paused),
        originCategory: current?.origin_claim ?? "UNKNOWN",
        evidenceStatus: current?.evidence_status ?? "UNVERIFIED",
        rightsStatus: current?.rights_state ?? "RESTRICTED"
      };
    });

    const { candles, lastUpdatedAt } = aggregateSpotCandles(fills);

    return {
      tracks,
      series: (seriesRes.data ?? []).map(this.mapSeries),
      listedPasses: (listedRes.data ?? []).map(this.mapPass),
      campaigns: (campaignsRes.data ?? []).map(this.mapCampaign),
      spotListings: (spotRes.data ?? []).map(this.mapSpotListing),
      distributionCycles: (cyclesRes.data ?? []).map(this.mapCycle),
      opinionMarkets: (marketsRes.data ?? []).map(this.mapMarket),
      candles,
      candlesLastUpdatedAt: lastUpdatedAt
    };
  }

  async getTrackPassport(trackId: string): Promise<TrackPassportSummary | null> {
    const { data } = await this.client
      .from("tracks")
      .select("*, manifest_versions(*)")
      .eq("id", trackId)
      .maybeSingle();
    if (!data) return null;
    const versions = Array.isArray(data.manifest_versions) ? data.manifest_versions : [];
    const current = versions.find((v: any) => v.version === data.current_version) ?? versions[0];
    if (!current) return null;
    return {
      trackId: data.id,
      title: data.title,
      artistName: data.artist_name ?? "Artist",
      artistWallet: data.artist_wallet ?? "11111111111111111111111111111111",
      currentVersion: data.current_version,
      manifestHash: current.hash,
      paused: Boolean(data.paused),
      originCategory: current.origin_claim,
      evidenceStatus: current.evidence_status,
      rightsStatus: current.rights_state
    };
  }

  async getSeriesById(seriesId: string): Promise<PassSeriesEntity | null> {
    const { data } = await this.client.from("series").select("*").eq("id", seriesId).maybeSingle();
    return data ? this.mapSeries(data) : null;
  }

  async createSeries(series: PassSeriesEntity): Promise<PassSeriesEntity> {
    const { data, error } = await this.client
      .from("series")
      .insert({
        id: series.id,
        artist_user_id: series.artistUserId,
        track_id: series.trackId,
        title: series.title,
        benefit_summary: series.benefitSummary,
        cap: series.cap,
        issued: series.issued,
        primary_price_smallest_units: series.primaryPriceSmallestUnits,
        expiry: series.expiry.toISOString(),
        status: series.status,
        deliverable_url: series.deliverableUrl
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return this.mapSeries(data);
  }

  async getPassById(passId: string): Promise<SupporterPassEntity | null> {
    const { data } = await this.client.from("passes").select("*").eq("id", passId).maybeSingle();
    return data ? this.mapPass(data) : null;
  }

  async listPassesByOwner(userId: string): Promise<SupporterPassEntity[]> {
    const { data } = await this.client.from("passes").select("*").eq("owner_user_id", userId);
    return (data ?? []).map(this.mapPass);
  }

  async savePass(pass: SupporterPassEntity): Promise<SupporterPassEntity> {
    const { data, error } = await this.client
      .from("passes")
      .upsert({
        id: pass.id,
        series_id: pass.seriesId,
        track_id: pass.trackId,
        serial: pass.serial,
        owner_user_id: pass.ownerUserId,
        owner_wallet: pass.ownerWallet,
        status: pass.status,
        nonce: pass.nonce,
        listing_price_smallest_units: pass.listingPriceSmallestUnits,
        listing_expiry: pass.listingExpiry ? pass.listingExpiry.toISOString() : null
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return this.mapPass(data);
  }

  async incrementSeriesIssued(seriesId: string): Promise<PassSeriesEntity> {
    const current = await this.getSeriesById(seriesId);
    if (!current) throw new Error("Series not found");
    const { data, error } = await this.client
      .from("series")
      .update({ issued: current.issued + 1 })
      .eq("id", seriesId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return this.mapSeries(data);
  }

  async recordSupportReceipt(receipt: SupportReceiptEntity): Promise<SupportReceiptEntity> {
    const { data, error } = await this.client
      .from("support_receipts")
      .insert({
        id: receipt.id,
        payer_user_id: receipt.payerUserId,
        payer_wallet: receipt.payerWallet,
        track_id: receipt.trackId,
        passport_version: receipt.passportVersion,
        manifest_hash: receipt.manifestHash,
        amount_smallest_units: receipt.amountSmallestUnits,
        artist_wallet: receipt.artistWallet,
        signature: receipt.signature,
        wallet_mode: receipt.walletMode,
        created_at: receipt.createdAt.toISOString()
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return this.mapReceipt(data);
  }

  async getReceiptBySignature(signature: string): Promise<SupportReceiptEntity | null> {
    const { data } = await this.client
      .from("support_receipts")
      .select("*")
      .eq("signature", signature)
      .maybeSingle();
    return data ? this.mapReceipt(data) : null;
  }

  async listReceiptsForUser(userId: string): Promise<SupportReceiptEntity[]> {
    const { data } = await this.client
      .from("support_receipts")
      .select("*")
      .eq("payer_user_id", userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map(this.mapReceipt);
  }

  async getCampaignById(campaignId: string): Promise<CampaignEntity | null> {
    const { data } = await this.client.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
    return data ? this.mapCampaign(data) : null;
  }

  async recordCampaignPledge(params: {
    campaignId: string;
    userId: string;
    amountSmallestUnits: string;
  }): Promise<CampaignEntity> {
    const campaign = await this.getCampaignById(params.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    const prevAmount = BigInt(await this.getCampaignPledgeAmount(params.campaignId, params.userId));
    const added = BigInt(params.amountSmallestUnits);
    await this.client.from("campaign_pledges").upsert({
      campaign_id: params.campaignId,
      user_id: params.userId,
      amount_smallest_units: (prevAmount + added).toString(),
      refund_claimed: false
    });
    const raised = (BigInt(campaign.raisedSmallestUnits) + added).toString();
    const nextStatus = BigInt(raised) >= BigInt(campaign.goalSmallestUnits) ? "FUNDED" : campaign.status;
    const { data, error } = await this.client
      .from("campaigns")
      .update({ raised_smallest_units: raised, status: nextStatus })
      .eq("id", params.campaignId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return this.mapCampaign(data);
  }

  async getCampaignPledgeAmount(campaignId: string, userId: string): Promise<string> {
    const { data } = await this.client
      .from("campaign_pledges")
      .select("amount_smallest_units")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? String(data.amount_smallest_units) : "0";
  }

  async markCampaignRefundClaimed(campaignId: string, userId: string): Promise<boolean> {
    const { data } = await this.client
      .from("campaign_pledges")
      .update({ refund_claimed: true })
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .eq("refund_claimed", false)
      .select("campaign_id");
    return Boolean(data && data.length > 0);
  }

  async getSpotListingById(spotListingId: string): Promise<SpotListingEntity | null> {
    const { data } = await this.client
      .from("spot_listings")
      .select("*")
      .eq("id", spotListingId)
      .maybeSingle();
    return data ? this.mapSpotListing(data) : null;
  }

  async saveSpotListing(listing: SpotListingEntity): Promise<SpotListingEntity> {
    const { data, error } = await this.client
      .from("spot_listings")
      .upsert({
        id: listing.id,
        campaign_id: listing.campaignId,
        seller_user_id: listing.sellerUserId,
        remaining_units: listing.remainingUnits,
        unit_price_smallest_units: listing.unitPriceSmallestUnits,
        active: listing.active
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return this.mapSpotListing(data);
  }

  async fillSpotListing(params: {
    spotListingId: string;
    buyerUserId: string;
    units: number;
  }): Promise<SpotListingEntity> {
    const listing = await this.getSpotListingById(params.spotListingId);
    if (!listing) throw new Error("Spot listing not found");
    const remaining = listing.remainingUnits - params.units;
    return this.saveSpotListing({
      ...listing,
      remainingUnits: remaining,
      active: remaining > 0
    });
  }

  async listSpotFills(campaignId?: string): Promise<SpotFillEntity[]> {
    const query = this.client.from("spot_fills").select("*").order("filled_at", { ascending: true });
    const { data } = campaignId ? await query.eq("campaign_id", campaignId) : await query;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      spotListingId: row.spot_listing_id,
      campaignId: row.campaign_id,
      buyerUserId: row.buyer_user_id,
      sellerUserId: row.seller_user_id,
      units: row.units,
      unitPriceSmallestUnits: String(row.unit_price_smallest_units),
      txSignature: row.tx_signature,
      filledAt: new Date(row.filled_at)
    }));
  }

  async getDistributionCycleById(cycleId: string): Promise<DistributionCycleEntity | null> {
    const { data } = await this.client
      .from("distribution_cycles")
      .select("*")
      .eq("id", cycleId)
      .maybeSingle();
    return data ? this.mapCycle(data) : null;
  }

  async saveDistributionCycle(cycle: DistributionCycleEntity): Promise<DistributionCycleEntity> {
    const { data, error } = await this.client
      .from("distribution_cycles")
      .upsert({
        id: cycle.id,
        campaign_id: cycle.campaignId,
        period_label: cycle.periodLabel,
        verified_revenue_smallest_units: cycle.verifiedRevenueSmallestUnits,
        claimed_smallest_units: cycle.claimedSmallestUnits,
        total_supply_snapshot: cycle.totalSupplySnapshot,
        record_date: cycle.recordDate.toISOString()
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return this.mapCycle(data);
  }

  async getDistributionApproval(cycleId: string): Promise<DistributionApprovalEntity | null> {
    const { data } = await this.client
      .from("distribution_approvals")
      .select("*")
      .eq("cycle_id", cycleId)
      .maybeSingle();
    if (!data) return null;
    return {
      cycleId: data.cycle_id,
      operatorUserId: data.operator_user_id,
      approverUserId: data.approver_user_id,
      evidenceHash: data.evidence_hash,
      reconciledAt: new Date(data.reconciled_at),
      approvedAt: data.approved_at ? new Date(data.approved_at) : null,
      fundedTxSig: data.funded_tx_sig,
      status: data.status
    };
  }

  async saveDistributionApproval(
    approval: DistributionApprovalEntity
  ): Promise<DistributionApprovalEntity> {
    const { data, error } = await this.client
      .from("distribution_approvals")
      .upsert({
        cycle_id: approval.cycleId,
        operator_user_id: approval.operatorUserId,
        approver_user_id: approval.approverUserId,
        evidence_hash: approval.evidenceHash,
        reconciled_at: approval.reconciledAt.toISOString(),
        approved_at: approval.approvedAt ? approval.approvedAt.toISOString() : null,
        funded_tx_sig: approval.fundedTxSig,
        status: approval.status
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      cycleId: data.cycle_id,
      operatorUserId: data.operator_user_id,
      approverUserId: data.approver_user_id,
      evidenceHash: data.evidence_hash,
      reconciledAt: new Date(data.reconciled_at),
      approvedAt: data.approved_at ? new Date(data.approved_at) : null,
      fundedTxSig: data.funded_tx_sig,
      status: data.status
    };
  }

  async getHolderShareUnits(campaignId: string, userId: string): Promise<number> {
    const { data } = await this.client
      .from("spot_fills")
      .select("units")
      .eq("campaign_id", campaignId)
      .eq("buyer_user_id", userId);
    return (data ?? []).reduce((sum: number, row: any) => sum + Number(row.units ?? 0), 0);
  }

  async getHolderShareUnitsAtRecordDate(
    cycleId: string,
    campaignId: string,
    userId: string,
    recordDate: Date
  ): Promise<number> {
    const { data: frozen } = await this.client
      .from("distribution_record_snapshots")
      .select("units")
      .eq("cycle_id", cycleId)
      .eq("user_id", userId)
      .maybeSingle();
    if (frozen) {
      return Number(frozen.units ?? 0);
    }

    const { data: fills } = await this.client
      .from("spot_fills")
      .select("buyer_user_id, seller_user_id, units")
      .eq("campaign_id", campaignId)
      .lte("filled_at", recordDate.toISOString());

    return (fills ?? []).reduce((acc: number, row: any) => {
      const units = Number(row.units ?? 0);
      if (row.buyer_user_id === userId) return acc + units;
      if (row.seller_user_id === userId) return Math.max(0, acc - units);
      return acc;
    }, 0);
  }

  async snapshotCycleHolders(
    cycleId: string,
    campaignId: string,
    recordDate: Date
  ): Promise<void> {
    const { data: fills } = await this.client
      .from("spot_fills")
      .select("buyer_user_id, seller_user_id, units")
      .eq("campaign_id", campaignId)
      .lte("filled_at", recordDate.toISOString());

    const balances = new Map<string, number>();
    for (const row of fills ?? []) {
      const units = Number((row as any).units ?? 0);
      const buyer = String((row as any).buyer_user_id);
      const seller = String((row as any).seller_user_id);
      balances.set(buyer, (balances.get(buyer) ?? 0) + units);
      if (balances.has(seller)) {
        balances.set(seller, Math.max(0, (balances.get(seller) ?? 0) - units));
      }
    }

    const rows = Array.from(balances.entries())
      .filter(([, units]) => units > 0)
      .map(([userId, units]) => ({
        cycle_id: cycleId,
        user_id: userId,
        units
      }));
    if (rows.length > 0) {
      await this.client.from("distribution_record_snapshots").upsert(rows);
    }
  }

  async markDistributionClaimed(cycleId: string, userId: string, amount: string): Promise<boolean> {
    const { error } = await this.client.from("distribution_claims").insert({
      cycle_id: cycleId,
      user_id: userId,
      payout_smallest_units: amount
    });
    if (error) return false;
    const cycle = await this.getDistributionCycleById(cycleId);
    if (cycle) {
      await this.saveDistributionCycle({
        ...cycle,
        claimedSmallestUnits: (BigInt(cycle.claimedSmallestUnits) + BigInt(amount)).toString()
      });
    }
    return true;
  }

  async recordCampaignReview(review: CampaignReviewEntity): Promise<CampaignReviewEntity> {
    const { data, error } = await this.client
      .from("campaign_reviews")
      .insert({
        id: review.id,
        campaign_id: review.campaignId,
        reviewer_user_id: review.reviewerUserId,
        decision: review.decision,
        notes: review.notes,
        terms_hash: review.termsHash,
        created_at: review.createdAt.toISOString()
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      campaignId: data.campaign_id,
      reviewerUserId: data.reviewer_user_id,
      decision: data.decision,
      notes: data.notes,
      termsHash: data.terms_hash,
      createdAt: new Date(data.created_at)
    };
  }

  async getMilestoneById(milestoneId: string): Promise<CampaignMilestoneEntity | null> {
    const { data } = await this.client
      .from("campaign_milestones")
      .select("*")
      .eq("id", milestoneId)
      .maybeSingle();
    if (!data) return null;
    return this.mapMilestone(data);
  }

  async saveMilestone(milestone: CampaignMilestoneEntity): Promise<CampaignMilestoneEntity> {
    const { data, error } = await this.client
      .from("campaign_milestones")
      .upsert({
        id: milestone.id,
        campaign_id: milestone.campaignId,
        sequence_index: milestone.sequenceIndex,
        title: milestone.title,
        release_amount_smallest_units: milestone.releaseAmountSmallestUnits,
        evidence_uri: milestone.evidenceUri,
        status: milestone.status,
        reviewer_user_id: milestone.reviewerUserId,
        updated_at: milestone.updatedAt.toISOString()
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return this.mapMilestone(data);
  }

  async getOpinionMarketById(marketId: string): Promise<OpinionMarketEntity | null> {
    const { data } = await this.client
      .from("opinion_markets")
      .select("*")
      .eq("id", marketId)
      .maybeSingle();
    return data ? this.mapMarket(data) : null;
  }

  async recordOpinionTrade(params: {
    marketId: string;
    userId: string;
    side: "YES" | "NO";
    pairsCount: number;
  }): Promise<OpinionMarketEntity> {
    const market = await this.getOpinionMarketById(params.marketId);
    if (!market) throw new Error("Opinion market not found");
    const { data, error } = await this.client
      .from("opinion_markets")
      .update({
        yes_pool_pairs: market.yesPoolPairs + (params.side === "YES" ? params.pairsCount : 0),
        no_pool_pairs: market.noPoolPairs + (params.side === "NO" ? params.pairsCount : 0)
      })
      .eq("id", params.marketId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return this.mapMarket(data);
  }

  private mapSeries = (row: any): PassSeriesEntity => ({
    id: row.id,
    trackId: row.track_id,
    artistUserId: row.artist_user_id,
    artistWallet: row.artist_wallet ?? "11111111111111111111111111111111",
    title: row.title,
    benefitSummary: row.benefit_summary,
    cap: row.cap,
    issued: row.issued,
    primaryPriceSmallestUnits: String(row.primary_price_smallest_units),
    expiry: new Date(row.expiry),
    status: row.status,
    deliverableUrl: row.deliverable_url
  });

  private mapPass = (row: any): SupporterPassEntity => ({
    id: row.id,
    seriesId: row.series_id,
    trackId: row.track_id,
    serial: row.serial,
    ownerUserId: row.owner_user_id,
    ownerWallet: row.owner_wallet,
    status: row.status,
    nonce: row.nonce,
    listingPriceSmallestUnits:
      row.listing_price_smallest_units != null ? String(row.listing_price_smallest_units) : null,
    listingExpiry: row.listing_expiry ? new Date(row.listing_expiry) : null
  });

  private mapReceipt = (row: any): SupportReceiptEntity => ({
    id: row.id,
    payerUserId: row.payer_user_id,
    payerWallet: row.payer_wallet,
    trackId: row.track_id,
    passportVersion: row.passport_version,
    manifestHash: row.manifest_hash,
    amountSmallestUnits: String(row.amount_smallest_units),
    artistWallet: row.artist_wallet,
    signature: row.signature,
    walletMode: row.wallet_mode,
    createdAt: new Date(row.created_at)
  });

  private mapCampaign = (row: any): CampaignEntity => ({
    id: row.id,
    trackId: row.track_id,
    artistUserId: row.artist_user_id,
    artistWallet: row.artist_wallet ?? "11111111111111111111111111111111",
    title: row.title,
    goalSmallestUnits: String(row.goal_smallest_units),
    raisedSmallestUnits: String(row.raised_smallest_units),
    shareSupply: row.share_supply,
    deadline: new Date(row.deadline),
    useOfFunds: row.use_of_funds,
    rightsScope: row.rights_scope,
    status: row.status,
    vaultAddress: row.vault_address
  });

  private mapSpotListing = (row: any): SpotListingEntity => ({
    id: row.id,
    campaignId: row.campaign_id,
    sellerUserId: row.seller_user_id,
    sellerWallet: row.seller_wallet ?? "11111111111111111111111111111111",
    remainingUnits: row.remaining_units,
    unitPriceSmallestUnits: String(row.unit_price_smallest_units),
    active: Boolean(row.active)
  });

  private mapCycle = (row: any): DistributionCycleEntity => ({
    id: row.id,
    campaignId: row.campaign_id,
    periodLabel: row.period_label,
    verifiedRevenueSmallestUnits: String(row.verified_revenue_smallest_units),
    claimedSmallestUnits: String(row.claimed_smallest_units),
    totalSupplySnapshot: row.total_supply_snapshot,
    recordDate: new Date(row.record_date)
  });

  private mapMarket = (row: any): OpinionMarketEntity => ({
    id: row.id,
    campaignId: row.campaign_id,
    question: row.question,
    tradingCutoff: new Date(row.trading_cutoff),
    campaignDeadline: new Date(row.campaign_deadline),
    vaultAddress: row.vault_address,
    yesPoolPairs: row.yes_pool_pairs,
    noPoolPairs: row.no_pool_pairs,
    resolvedOutcome: row.resolved_outcome
  });

  private mapMilestone = (row: any): CampaignMilestoneEntity => ({
    id: row.id,
    campaignId: row.campaign_id,
    sequenceIndex: row.sequence_index,
    title: row.title,
    releaseAmountSmallestUnits: String(row.release_amount_smallest_units),
    evidenceUri: row.evidence_uri,
    status: row.status,
    reviewerUserId: row.reviewer_user_id,
    updatedAt: new Date(row.updated_at)
  });
}
