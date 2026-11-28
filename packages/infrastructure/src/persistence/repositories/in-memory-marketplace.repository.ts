import type { TrackPassportSummary } from "@encore/contracts";
import type {
  CampaignEntity,
  CandlePoint,
  DistributionCycleEntity,
  MarketplaceRepositoryPort,
  MarketplaceSnapshot,
  OpinionMarketEntity,
  PassSeriesEntity,
  SpotListingEntity,
  SupportReceiptEntity,
  SupporterPassEntity
} from "@encore/core";

const SEED_TRACKS: TrackPassportSummary[] = [
  {
    trackId: "h01-midnight-sessions",
    title: "Midnight Sessions (Acoustic Demo)",
    artistName: "Aria Chen",
    artistWallet: "11111111111111111111111111111111",
    currentVersion: 1,
    manifestHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
    paused: false,
    originCategory: "HUMAN_CREATED",
    evidenceStatus: "CORROBORATED",
    rightsStatus: "PREVIEW_ALLOWED"
  },
  {
    trackId: "a01-neon-drift",
    title: "Neon Drift (AI-Assisted Stem Mix)",
    artistName: "Kairo Beats",
    artistWallet: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    currentVersion: 2,
    manifestHash: "b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1",
    paused: false,
    originCategory: "AI_ASSISTED",
    evidenceStatus: "SELF_DECLARED",
    rightsStatus: "PREVIEW_ALLOWED"
  },
  {
    trackId: "g01-synth-horizon",
    title: "Synth Horizon (Licensed AI Generation)",
    artistName: "Sora Studio",
    artistWallet: "SysvarRent111111111111111111111111111111111",
    currentVersion: 1,
    manifestHash: "c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2",
    paused: false,
    originCategory: "AI_GENERATED",
    evidenceStatus: "CORROBORATED",
    rightsStatus: "EXTERNAL_LICENSE_ONLY"
  }
];

const SEED_CANDLES: CandlePoint[] = [
  { time: "12:00 UTC", open: 1.02, high: 1.08, low: 0.99, close: 1.06 },
  { time: "13:00 UTC", open: 1.06, high: 1.12, low: 1.02, close: 1.04 },
  { time: "14:00 UTC", open: 1.04, high: 1.15, low: 1.04, close: 1.13 },
  { time: "15:00 UTC", open: 1.13, high: 1.17, low: 1.08, close: 1.1 },
  { time: "16:00 UTC", open: 1.1, high: 1.22, low: 1.09, close: 1.2 },
  { time: "17:00 UTC", open: 1.2, high: 1.26, low: 1.16, close: 1.24 }
];

export class InMemoryMarketplaceRepository implements MarketplaceRepositoryPort {
  private readonly tracks = new Map<string, TrackPassportSummary>();
  private readonly series = new Map<string, PassSeriesEntity>();
  private readonly passes = new Map<string, SupporterPassEntity>();
  private readonly receipts = new Map<string, SupportReceiptEntity>();
  private readonly campaigns = new Map<string, CampaignEntity>();
  private readonly pledges = new Map<string, string>();
  private readonly refundedPledges = new Set<string>();
  private readonly spotListings = new Map<string, SpotListingEntity>();
  private readonly shareBalances = new Map<string, number>();
  private readonly cycles = new Map<string, DistributionCycleEntity>();
  private readonly claimedCycles = new Set<string>();
  private readonly markets = new Map<string, OpinionMarketEntity>();

  constructor() {
    for (const t of SEED_TRACKS) this.tracks.set(t.trackId, t);

    const expiry = new Date(Date.now() + 30 * 86_400_000);
    this.series.set("series-midnight-ep", {
      id: "series-midnight-ep",
      trackId: "h01-midnight-sessions",
      artistUserId: "seed-artist-aria",
      artistWallet: "11111111111111111111111111111111",
      title: "Midnight Sessions Studio Diary Pass",
      benefitSummary: "Pre-prepared lossless commentary & stem breakdown PDF (non-DRM)",
      cap: 50,
      issued: 3,
      primaryPriceSmallestUnits: "10000000", // 10 test USDC
      expiry,
      status: "ACTIVE",
      deliverableUrl: "https://encore.devnet.local/deliverables/midnight-sessions-diary"
    });

    this.passes.set("pass-demo-listed-1", {
      id: "pass-demo-listed-1",
      seriesId: "series-midnight-ep",
      trackId: "h01-midnight-sessions",
      serial: 1,
      ownerUserId: "seed-fan-1",
      ownerWallet: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      status: "LISTED",
      nonce: 1,
      listingPriceSmallestUnits: "15000000", // 15 test USDC
      listingExpiry: expiry
    });

    this.campaigns.set("camp-midnight-ep", {
      id: "camp-midnight-ep",
      trackId: "h01-midnight-sessions",
      artistUserId: "seed-artist-aria",
      artistWallet: "11111111111111111111111111111111",
      title: "Midnight Sessions EP Production",
      goalSmallestUnits: "500000000", // 500 test USDC
      raisedSmallestUnits: "320000000", // 320 test USDC
      shareSupply: 500,
      deadline: new Date(Date.now() + 14 * 86_400_000),
      useOfFunds: "Studio mastering, session musicians & visual artwork",
      rightsScope: "Simulated devnet project-share unit (non-investment demo)",
      status: "FUNDING",
      vaultAddress: "11111111111111111111111111111111"
    });

    this.spotListings.set("spot-midnight-1", {
      id: "spot-midnight-1",
      campaignId: "camp-midnight-ep",
      sellerUserId: "seed-fan-1",
      sellerWallet: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      remainingUnits: 20,
      unitPriceSmallestUnits: "1280000", // 1.28 test USDC / unit
      active: true
    });

    this.cycles.set("cycle-q4-sim", {
      id: "cycle-q4-sim",
      campaignId: "camp-midnight-ep",
      periodLabel: "Q4 Synthetic Distribution Cycle",
      verifiedRevenueSmallestUnits: "100000000", // 100 test USDC simulated
      claimedSmallestUnits: "25000000",
      totalSupplySnapshot: 500,
      recordDate: new Date()
    });

    this.markets.set("om-midnight-goal", {
      id: "om-midnight-goal",
      campaignId: "camp-midnight-ep",
      question: "Will Midnight Sessions EP reach its 500 test USDC goal before deadline?",
      tradingCutoff: new Date(Date.now() + 10 * 86_400_000),
      campaignDeadline: new Date(Date.now() + 14 * 86_400_000),
      vaultAddress: "SysvarRent111111111111111111111111111111111",
      yesPoolPairs: 42,
      noPoolPairs: 18,
      resolvedOutcome: "UNRESOLVED"
    });
  }

  async getMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
    return {
      tracks: Array.from(this.tracks.values()),
      series: Array.from(this.series.values()),
      listedPasses: Array.from(this.passes.values()).filter((p) => p.status === "LISTED"),
      campaigns: Array.from(this.campaigns.values()),
      spotListings: Array.from(this.spotListings.values()).filter((s) => s.active),
      distributionCycles: Array.from(this.cycles.values()),
      opinionMarkets: Array.from(this.markets.values()),
      candles: SEED_CANDLES
    };
  }

  async getTrackPassport(trackId: string) {
    return this.tracks.get(trackId) ?? null;
  }
  async getSeriesById(seriesId: string) {
    return this.series.get(seriesId) ?? null;
  }
  async createSeries(series: PassSeriesEntity) {
    this.series.set(series.id, series);
    return series;
  }
  async getPassById(passId: string) {
    return this.passes.get(passId) ?? null;
  }
  async listPassesByOwner(userId: string) {
    return Array.from(this.passes.values()).filter((p) => p.ownerUserId === userId);
  }
  async savePass(pass: SupporterPassEntity) {
    this.passes.set(pass.id, pass);
    return pass;
  }
  async incrementSeriesIssued(seriesId: string) {
    const s = this.series.get(seriesId);
    if (!s) throw new Error("Series not found");
    const updated = { ...s, issued: s.issued + 1 };
    this.series.set(seriesId, updated);
    return updated;
  }
  async recordSupportReceipt(receipt: SupportReceiptEntity) {
    this.receipts.set(receipt.signature, receipt);
    return receipt;
  }
  async getReceiptBySignature(signature: string) {
    return this.receipts.get(signature) ?? null;
  }
  async listReceiptsForUser(userId: string) {
    return Array.from(this.receipts.values()).filter((r) => r.payerUserId === userId);
  }
  async getCampaignById(campaignId: string) {
    return this.campaigns.get(campaignId) ?? null;
  }
  async recordCampaignPledge(params: {
    campaignId: string;
    userId: string;
    amountSmallestUnits: string;
  }) {
    const c = this.campaigns.get(params.campaignId);
    if (!c) throw new Error("Campaign not found");
    const key = `${params.campaignId}:${params.userId}`;
    const prev = BigInt(this.pledges.get(key) ?? "0");
    const added = BigInt(params.amountSmallestUnits);
    this.pledges.set(key, (prev + added).toString());
    const raised = (BigInt(c.raisedSmallestUnits) + added).toString();
    const updated: CampaignEntity = {
      ...c,
      raisedSmallestUnits: raised,
      status: BigInt(raised) >= BigInt(c.goalSmallestUnits) ? "FUNDED" : c.status
    };
    this.campaigns.set(c.id, updated);
    return updated;
  }
  async getCampaignPledgeAmount(campaignId: string, userId: string) {
    return this.pledges.get(`${campaignId}:${userId}`) ?? "0";
  }
  async markCampaignRefundClaimed(campaignId: string, userId: string) {
    const key = `${campaignId}:${userId}`;
    if (this.refundedPledges.has(key)) return false;
    this.refundedPledges.add(key);
    return true;
  }
  async getSpotListingById(spotListingId: string) {
    return this.spotListings.get(spotListingId) ?? null;
  }
  async fillSpotListing(params: {
    spotListingId: string;
    buyerUserId: string;
    units: number;
  }) {
    const l = this.spotListings.get(params.spotListingId);
    if (!l) throw new Error("Spot listing not found");
    const remaining = l.remainingUnits - params.units;
    const updated: SpotListingEntity = {
      ...l,
      remainingUnits: remaining,
      active: remaining > 0
    };
    this.spotListings.set(l.id, updated);
    const balKey = `${l.campaignId}:${params.buyerUserId}`;
    this.shareBalances.set(balKey, (this.shareBalances.get(balKey) ?? 0) + params.units);
    return updated;
  }
  async getDistributionCycleById(cycleId: string) {
    return this.cycles.get(cycleId) ?? null;
  }
  async getHolderShareUnits(campaignId: string, userId: string) {
    return this.shareBalances.get(`${campaignId}:${userId}`) ?? 0;
  }
  async markDistributionClaimed(cycleId: string, userId: string, amount: string) {
    const key = `${cycleId}:${userId}`;
    if (this.claimedCycles.has(key)) return false;
    this.claimedCycles.add(key);
    const c = this.cycles.get(cycleId);
    if (c) {
      this.cycles.set(cycleId, {
        ...c,
        claimedSmallestUnits: (BigInt(c.claimedSmallestUnits) + BigInt(amount)).toString()
      });
    }
    return true;
  }
  async getOpinionMarketById(marketId: string) {
    return this.markets.get(marketId) ?? null;
  }
  async recordOpinionTrade(params: {
    marketId: string;
    userId: string;
    side: "YES" | "NO";
    pairsCount: number;
  }) {
    const m = this.markets.get(params.marketId);
    if (!m) throw new Error("Opinion market not found");
    const updated: OpinionMarketEntity = {
      ...m,
      yesPoolPairs: m.yesPoolPairs + (params.side === "YES" ? params.pairsCount : 0),
      noPoolPairs: m.noPoolPairs + (params.side === "NO" ? params.pairsCount : 0)
    };
    this.markets.set(m.id, updated);
    return updated;
  }
}
