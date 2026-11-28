import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import type { MarketplaceChainPort, UnsignedChainTransaction } from "@encore/core";
import {
  DEFAULT_ENCORE_PROGRAM_ID,
  DEFAULT_TEST_USDC_MINT,
  SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
  buildBuyListingInstructions,
  buildBuyPrimaryInstructions,
  buildBuySpotInstructions,
  buildCancelPassListingInstructions,
  buildCancelSpotListingInstructions,
  buildClaimDistributionInstructions,
  buildCreateCampaignInstructions,
  buildCreateSeriesInstructions,
  buildCreateSpotListingInstructions,
  buildDirectSupportInstructions,
  buildDistributionMerkleTree,
  buildExpirePassInstructions,
  buildListPassInstructions,
  buildOpenDistributionCycleInstructions,
  buildPledgeCampaignInstructions,
  buildRedeemPassInstructions,
  buildRefundCampaignInstructions,
  buildReleaseMilestoneInstructions,
  extractEncoreEventsFromLogs,
  serializeUnsignedTransaction
} from "@encore/solana-client";

const DEFAULT_PLATFORM_TREASURY = "2VXLffNhejZKNgeN9dNjG4s7pe8T6bGihQBmVGbTn2vM";
const OFFLINE_TEST_BLOCKHASH = "11111111111111111111111111111111";

export interface SolanaMarketplaceAdapterOptions {
  readonly programId?: string;
  readonly rpcUrl?: string;
  readonly mint?: string;
  readonly platformWallet?: string;
  readonly cluster?: string;
  readonly offlineBlockhashFallback?: boolean;
}

export class SolanaMarketplaceChainAdapter implements MarketplaceChainPort {
  readonly programId: string;
  readonly rpcUrl: string;
  readonly mint: string;
  readonly platformWallet: string;
  readonly cluster: string;
  readonly connection: Connection;
  private readonly offlineFallback: boolean;

  constructor(
    programIdOrOptions: string | SolanaMarketplaceAdapterOptions = DEFAULT_ENCORE_PROGRAM_ID,
    rpcUrlArg?: string
  ) {
    const opts: SolanaMarketplaceAdapterOptions =
      typeof programIdOrOptions === "string"
        ? { programId: programIdOrOptions, rpcUrl: rpcUrlArg }
        : programIdOrOptions;

    this.programId =
      opts.programId && opts.programId !== OFFLINE_TEST_BLOCKHASH
        ? opts.programId
        : DEFAULT_ENCORE_PROGRAM_ID;
    this.rpcUrl =
      opts.rpcUrl ??
      process.env.SOLANA_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      "https://api.devnet.solana.com";
    this.mint =
      opts.mint ?? process.env.NEXT_PUBLIC_TEST_USDC_MINT ?? DEFAULT_TEST_USDC_MINT;
    this.platformWallet =
      opts.platformWallet ??
      process.env.ENCORE_PLATFORM_WALLET ??
      process.env.NEXT_PUBLIC_PLATFORM_WALLET ??
      DEFAULT_PLATFORM_TREASURY;
    this.cluster = opts.cluster ?? process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
    this.offlineFallback =
      opts.offlineBlockhashFallback ?? Boolean(process.env.VITEST);
    this.connection = new Connection(this.rpcUrl, "confirmed");
  }

  private async resolveBlockhash(): Promise<{
    blockhash: string;
    lastValidBlockHeight?: number;
  }> {
    if (this.offlineFallback) {
      return { blockhash: OFFLINE_TEST_BLOCKHASH };
    }
    const latest = await this.connection.getLatestBlockhash("confirmed");
    return {
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight
    };
  }

  private async packageUnsigned(params: {
    instructionName: string;
    payer: string;
    instructions: Parameters<typeof serializeUnsignedTransaction>[0]["instructions"];
    expectedSigners: readonly string[];
    accounts: Record<string, string>;
  }): Promise<UnsignedChainTransaction> {
    const { blockhash, lastValidBlockHeight } = await this.resolveBlockhash();
    const serializedBase64 = serializeUnsignedTransaction({
      payer: params.payer,
      instructions: params.instructions,
      recentBlockhash: blockhash
    });
    return {
      instructionName: params.instructionName,
      serializedBase64,
      expectedSigners: params.expectedSigners,
      programId: this.programId,
      recentBlockhash: blockhash,
      lastValidBlockHeight,
      cluster: this.cluster,
      accounts: params.accounts
    };
  }

  async buildDirectSupportTx(params: {
    payerWallet: string;
    artistWallet: string;
    trackId: string;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
    nonce: string;
  }): Promise<UnsignedChainTransaction> {
    const built = buildDirectSupportInstructions({
      programId: this.programId,
      mint: this.mint,
      payerWallet: params.payerWallet,
      artistWallet: params.artistWallet,
      trackId: params.trackId,
      version: params.version,
      manifestHash: params.manifestHash,
      amountSmallestUnits: params.amountSmallestUnits,
      nonce: params.nonce,
      ensureAtas: true
    });
    return this.packageUnsigned({
      instructionName: "direct_support",
      payer: params.payerWallet,
      instructions: built.instructions,
      expectedSigners: [params.payerWallet],
      accounts: {
        artist: built.artistPda.toBase58(),
        track: built.trackPda.toBase58(),
        receipt: built.receiptPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async buildCreateSeriesTx(params: {
    artistWallet: string;
    trackId: string;
    seriesId: string;
    termsHash: string;
    benefitHash: string;
    cap: number;
    primaryPriceSmallestUnits: string;
    expiryUnixSeconds: number;
  }): Promise<UnsignedChainTransaction> {
    const built = buildCreateSeriesInstructions({
      programId: this.programId,
      mint: this.mint,
      artistWallet: params.artistWallet,
      platformWallet: this.platformWallet,
      trackId: params.trackId,
      seriesId: params.seriesId,
      termsHash: params.termsHash,
      benefitHash: params.benefitHash,
      cap: params.cap,
      primaryPriceSmallestUnits: params.primaryPriceSmallestUnits,
      expiryUnixSeconds: params.expiryUnixSeconds
    });
    return this.packageUnsigned({
      instructionName: "create_series",
      payer: params.artistWallet,
      instructions: built.instructions,
      expectedSigners: [params.artistWallet],
      accounts: {
        artist: built.artistPda.toBase58(),
        track: built.trackPda.toBase58(),
        series: built.seriesPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async buildPrimaryPassPurchaseTx(params: {
    buyerWallet: string;
    artistWallet: string;
    trackId?: string;
    seriesId: string;
    serial: number;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const built = buildBuyPrimaryInstructions({
      programId: this.programId,
      mint: this.mint,
      buyerWallet: params.buyerWallet,
      artistWallet: params.artistWallet,
      platformWallet: this.platformWallet,
      trackId: params.trackId ?? params.seriesId,
      seriesId: params.seriesId,
      serial: params.serial,
      version: params.version,
      manifestHash: params.manifestHash,
      ensureAtas: true
    });
    return this.packageUnsigned({
      instructionName: "buy_primary",
      payer: params.buyerWallet,
      instructions: built.instructions,
      expectedSigners: [params.buyerWallet],
      accounts: {
        artist: built.artistPda.toBase58(),
        track: built.trackPda.toBase58(),
        series: built.seriesPda.toBase58(),
        pass: built.passPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async buildListPassTx(params: {
    ownerWallet: string;
    artistWallet: string;
    trackId: string;
    seriesId: string;
    serial: number;
    listingPriceSmallestUnits: string;
    listingExpiryUnixSeconds: number;
  }): Promise<UnsignedChainTransaction> {
    const built = buildListPassInstructions({
      programId: this.programId,
      ownerWallet: params.ownerWallet,
      artistWallet: params.artistWallet,
      trackId: params.trackId,
      seriesId: params.seriesId,
      serial: params.serial,
      listingPriceSmallestUnits: params.listingPriceSmallestUnits,
      listingExpiryUnixSeconds: params.listingExpiryUnixSeconds
    });
    return this.packageUnsigned({
      instructionName: "list_pass",
      payer: params.ownerWallet,
      instructions: built.instructions,
      expectedSigners: [params.ownerWallet],
      accounts: {
        series: built.seriesPda.toBase58(),
        pass: built.passPda.toBase58()
      }
    });
  }

  async buildCancelPassListingTx(params: {
    ownerWallet: string;
    artistWallet: string;
    seriesId: string;
    serial: number;
  }): Promise<UnsignedChainTransaction> {
    const built = buildCancelPassListingInstructions({
      programId: this.programId,
      ownerWallet: params.ownerWallet,
      artistWallet: params.artistWallet,
      seriesId: params.seriesId,
      serial: params.serial
    });
    return this.packageUnsigned({
      instructionName: "cancel_pass_listing",
      payer: params.ownerWallet,
      instructions: built.instructions,
      expectedSigners: [params.ownerWallet],
      accounts: {
        series: built.seriesPda.toBase58(),
        pass: built.passPda.toBase58()
      }
    });
  }

  async buildListingPurchaseTx(params: {
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
  }): Promise<UnsignedChainTransaction> {
    const built = buildBuyListingInstructions({
      programId: this.programId,
      mint: this.mint,
      buyerWallet: params.buyerWallet,
      sellerWallet: params.sellerWallet,
      artistWallet: params.artistWallet,
      platformWallet: this.platformWallet,
      trackId: params.trackId ?? params.passId,
      seriesId: params.seriesId ?? params.passId,
      serial: params.serial ?? 1,
      expectedNonce: params.nonce,
      expectedVersion: params.version,
      manifestHash: params.manifestHash,
      ensureAtas: true
    });
    return this.packageUnsigned({
      instructionName: "buy_listing",
      payer: params.buyerWallet,
      instructions: built.instructions,
      expectedSigners: [params.buyerWallet],
      accounts: {
        artist: built.artistPda.toBase58(),
        track: built.trackPda.toBase58(),
        series: built.seriesPda.toBase58(),
        pass: built.passPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async buildRedeemPassTx(params: {
    ownerWallet: string;
    artistWallet: string;
    seriesId: string;
    serial: number;
  }): Promise<UnsignedChainTransaction> {
    const built = buildRedeemPassInstructions({
      programId: this.programId,
      ownerWallet: params.ownerWallet,
      artistWallet: params.artistWallet,
      seriesId: params.seriesId,
      serial: params.serial
    });
    return this.packageUnsigned({
      instructionName: "redeem_pass",
      payer: params.ownerWallet,
      instructions: built.instructions,
      expectedSigners: [params.ownerWallet],
      accounts: {
        series: built.seriesPda.toBase58(),
        pass: built.passPda.toBase58()
      }
    });
  }

  async buildExpirePassTx(params: {
    payerWallet: string;
    artistWallet: string;
    seriesId: string;
    serial: number;
  }): Promise<UnsignedChainTransaction> {
    const built = buildExpirePassInstructions({
      programId: this.programId,
      artistWallet: params.artistWallet,
      seriesId: params.seriesId,
      serial: params.serial
    });
    return this.packageUnsigned({
      instructionName: "expire_pass",
      payer: params.payerWallet,
      instructions: built.instructions,
      expectedSigners: [params.payerWallet],
      accounts: {
        series: built.seriesPda.toBase58(),
        pass: built.passPda.toBase58()
      }
    });
  }

  async buildCreateCampaignTx(params: {
    artistWallet: string;
    trackId: string;
    campaignId: string;
    termsHash: string;
    goalSmallestUnits: string;
    shareSupply: number;
    deadlineUnixSeconds: number;
  }): Promise<UnsignedChainTransaction> {
    const built = buildCreateCampaignInstructions({
      programId: this.programId,
      mint: this.mint,
      artistWallet: params.artistWallet,
      trackId: params.trackId,
      campaignId: params.campaignId,
      termsHash: params.termsHash,
      goalSmallestUnits: params.goalSmallestUnits,
      shareSupply: params.shareSupply,
      deadlineUnixSeconds: params.deadlineUnixSeconds
    });
    return this.packageUnsigned({
      instructionName: "create_campaign",
      payer: params.artistWallet,
      instructions: built.instructions,
      expectedSigners: [params.artistWallet],
      accounts: {
        artist: built.artistPda.toBase58(),
        track: built.trackPda.toBase58(),
        campaign: built.campaignPda.toBase58(),
        campaignVault: built.campaignVaultPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async buildCampaignPledgeTx(params: {
    payerWallet: string;
    artistWallet?: string;
    vaultAddress: string;
    campaignId: string;
    nonce?: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const built = buildPledgeCampaignInstructions({
      programId: this.programId,
      mint: this.mint,
      payerWallet: params.payerWallet,
      artistWallet: params.artistWallet ?? params.payerWallet,
      campaignId: params.campaignId,
      vaultAddress:
        params.vaultAddress !== OFFLINE_TEST_BLOCKHASH ? params.vaultAddress : undefined,
      nonce: params.nonce ?? "1",
      amountSmallestUnits: params.amountSmallestUnits
    });
    return this.packageUnsigned({
      instructionName: "pledge_campaign",
      payer: params.payerWallet,
      instructions: built.instructions,
      expectedSigners: [params.payerWallet],
      accounts: {
        campaign: built.campaignPda.toBase58(),
        pledge: built.pledgePda.toBase58(),
        vault: built.vaultPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async buildReleaseMilestoneTx(params: {
    artistWallet: string;
    campaignId: string;
    vaultAddress: string;
    milestoneIndex: number;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const built = buildReleaseMilestoneInstructions({
      programId: this.programId,
      mint: this.mint,
      artistWallet: params.artistWallet,
      campaignId: params.campaignId,
      vaultAddress:
        params.vaultAddress !== OFFLINE_TEST_BLOCKHASH ? params.vaultAddress : undefined,
      milestoneIndex: params.milestoneIndex,
      amountSmallestUnits: params.amountSmallestUnits,
      ensureAtas: true
    });
    return this.packageUnsigned({
      instructionName: "release_milestone",
      payer: params.artistWallet,
      instructions: built.instructions,
      expectedSigners: [params.artistWallet],
      accounts: {
        campaign: built.campaignPda.toBase58(),
        vault: built.vaultPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async buildCampaignRefundTx(params: {
    claimerWallet: string;
    artistWallet?: string;
    vaultAddress: string;
    campaignId: string;
    pledgeNonce?: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const built = buildRefundCampaignInstructions({
      programId: this.programId,
      mint: this.mint,
      claimerWallet: params.claimerWallet,
      artistWallet: params.artistWallet ?? params.claimerWallet,
      campaignId: params.campaignId,
      vaultAddress:
        params.vaultAddress !== OFFLINE_TEST_BLOCKHASH ? params.vaultAddress : undefined,
      pledgeNonce: params.pledgeNonce ?? "1",
      ensureAtas: true
    });
    return this.packageUnsigned({
      instructionName: "refund_campaign",
      payer: params.claimerWallet,
      instructions: built.instructions,
      expectedSigners: [params.claimerWallet],
      accounts: {
        campaign: built.campaignPda.toBase58(),
        pledge: built.pledgePda.toBase58(),
        vault: built.vaultPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async buildCreateSpotListingTx(params: {
    sellerWallet: string;
    artistWallet: string;
    campaignId: string;
    spotListingId: string;
    units: number;
    unitPriceSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const built = buildCreateSpotListingInstructions({
      programId: this.programId,
      sellerWallet: params.sellerWallet,
      artistWallet: params.artistWallet,
      campaignId: params.campaignId,
      spotListingId: params.spotListingId,
      units: params.units,
      unitPriceSmallestUnits: params.unitPriceSmallestUnits
    });
    return this.packageUnsigned({
      instructionName: "create_spot_listing",
      payer: params.sellerWallet,
      instructions: built.instructions,
      expectedSigners: [params.sellerWallet],
      accounts: {
        campaign: built.campaignPda.toBase58(),
        spotListing: built.spotListingPda.toBase58()
      }
    });
  }

  async buildCancelSpotListingTx(params: {
    sellerWallet: string;
    artistWallet: string;
    campaignId: string;
    spotListingId: string;
  }): Promise<UnsignedChainTransaction> {
    const built = buildCancelSpotListingInstructions({
      programId: this.programId,
      sellerWallet: params.sellerWallet,
      artistWallet: params.artistWallet,
      campaignId: params.campaignId,
      spotListingId: params.spotListingId
    });
    return this.packageUnsigned({
      instructionName: "cancel_spot_listing",
      payer: params.sellerWallet,
      instructions: built.instructions,
      expectedSigners: [params.sellerWallet],
      accounts: {
        campaign: built.campaignPda.toBase58(),
        spotListing: built.spotListingPda.toBase58()
      }
    });
  }

  async buildSpotBuyTx(params: {
    buyerWallet: string;
    sellerWallet: string;
    artistWallet?: string;
    spotListingId: string;
    campaignId: string;
    units: number;
    expectedNonce?: number;
    unitPriceSmallestUnits: string;
    totalSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const built = buildBuySpotInstructions({
      programId: this.programId,
      mint: this.mint,
      buyerWallet: params.buyerWallet,
      sellerWallet: params.sellerWallet,
      artistWallet: params.artistWallet ?? params.sellerWallet,
      campaignId: params.campaignId,
      spotListingId: params.spotListingId,
      units: params.units,
      expectedNonce: params.expectedNonce ?? 0,
      ensureAtas: true
    });
    return this.packageUnsigned({
      instructionName: "buy_spot",
      payer: params.buyerWallet,
      instructions: built.instructions,
      expectedSigners: [params.buyerWallet],
      accounts: {
        campaign: built.campaignPda.toBase58(),
        spotListing: built.spotListingPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async buildOpenDistributionCycleTx(params: {
    authorityWallet: string;
    artistWallet: string;
    campaignId: string;
    cycleId: string;
    evidenceHash: string;
    merkleRootHex?: string;
    entitlements?: ReadonlyArray<{ claimerWallet: string; amountSmallestUnits: string }>;
    verifiedRevenueSmallestUnits: string;
    totalSupplySnapshot: number;
  }): Promise<UnsignedChainTransaction> {
    let merkleRootHex = params.merkleRootHex;
    if (!merkleRootHex && params.entitlements && params.entitlements.length > 0) {
      merkleRootHex = buildDistributionMerkleTree(
        params.entitlements.map((e) => ({
          claimerWallet: e.claimerWallet,
          amountSmallestUnits: BigInt(e.amountSmallestUnits)
        }))
      ).rootHex;
    }
    if (!merkleRootHex) {
      merkleRootHex = buildDistributionMerkleTree([
        {
          claimerWallet: params.authorityWallet,
          amountSmallestUnits: BigInt(params.verifiedRevenueSmallestUnits)
        }
      ]).rootHex;
    }

    const built = buildOpenDistributionCycleInstructions({
      programId: this.programId,
      mint: this.mint,
      authorityWallet: params.authorityWallet,
      artistWallet: params.artistWallet,
      campaignId: params.campaignId,
      cycleId: params.cycleId,
      evidenceHash: params.evidenceHash,
      merkleRootHex,
      verifiedRevenueSmallestUnits: params.verifiedRevenueSmallestUnits,
      totalSupplySnapshot: params.totalSupplySnapshot
    });
    return this.packageUnsigned({
      instructionName: "open_distribution_cycle",
      payer: params.authorityWallet,
      instructions: built.instructions,
      expectedSigners: [params.authorityWallet],
      accounts: {
        campaign: built.campaignPda.toBase58(),
        cycle: built.cyclePda.toBase58(),
        distributionVault: built.distributionVaultPda.toBase58(),
        mint: built.mint.toBase58(),
        merkleRootHex
      }
    });
  }

  async buildDistributionClaimTx(params: {
    claimerWallet: string;
    artistWallet?: string;
    vaultAddress: string;
    cycleId: string;
    campaignId: string;
    payoutSmallestUnits: string;
    merkleProofHex?: readonly string[];
    entitlements?: ReadonlyArray<{ claimerWallet: string; amountSmallestUnits: string }>;
  }): Promise<UnsignedChainTransaction> {
    let proof: Buffer[];
    if (params.merkleProofHex) {
      proof = params.merkleProofHex.map((h) => Buffer.from(h, "hex"));
    } else if (params.entitlements && params.entitlements.length > 0) {
      proof = buildDistributionMerkleTree(
        params.entitlements.map((e) => ({
          claimerWallet: e.claimerWallet,
          amountSmallestUnits: BigInt(e.amountSmallestUnits)
        }))
      ).getProof(params.claimerWallet, BigInt(params.payoutSmallestUnits));
    } else {
      proof = [];
    }
    const built = buildClaimDistributionInstructions({
      programId: this.programId,
      mint: this.mint,
      claimerWallet: params.claimerWallet,
      artistWallet: params.artistWallet ?? params.claimerWallet,
      campaignId: params.campaignId,
      cycleId: params.cycleId,
      payoutSmallestUnits: params.payoutSmallestUnits,
      merkleProof: proof,
      ensureAtas: true
    });
    return this.packageUnsigned({
      instructionName: "claim_distribution",
      payer: params.claimerWallet,
      instructions: built.instructions,
      expectedSigners: [params.claimerWallet],
      accounts: {
        campaign: built.campaignPda.toBase58(),
        cycle: built.cyclePda.toBase58(),
        distributionVault: built.distributionVaultPda.toBase58(),
        claim: built.claimPda.toBase58(),
        mint: built.mint.toBase58()
      }
    });
  }

  async submitSignedTransaction(signedBase64: string): Promise<{ signature: string }> {
    const tx = Transaction.from(Buffer.from(signedBase64, "base64"));
    const encoreProgram = new PublicKey(this.programId);
    const allowedPrograms = [encoreProgram, SPL_ASSOCIATED_TOKEN_PROGRAM_ID];
    if (
      !tx.verifySignatures() ||
      tx.instructions.length === 0 ||
      !tx.instructions.some((ix) => ix.programId.equals(encoreProgram)) ||
      tx.instructions.some((ix) => !allowedPrograms.some((p) => ix.programId.equals(p)))
    ) {
      throw new Error("Signed transaction contains unverified signatures or disallowed programs");
    }
    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false
    });
    const confirmation = await this.connection.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) {
      throw new Error("Signed transaction failed during Solana confirmation");
    }
    return { signature };
  }

  async verifyFinalizedMarketplaceTx(params: {
    signature: string;
    expectedInstruction: string;
    expectedSigner?: string;
    expectedAccounts?: readonly string[];
  }): Promise<{
    verified: boolean;
    slot: number;
    events: ReadonlyArray<{ name: string; dataBase64: string }>;
    reason?: string;
  }> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          params.signature,
          {
            encoding: "jsonParsed",
            commitment: "finalized",
            maxSupportedTransactionVersion: 0
          }
        ]
      })
    }).catch(() => null);

    if (!response || !response.ok) {
      return {
        verified: false,
        slot: 0,
        events: [],
        reason: "Unable to reach Solana RPC for finalized transaction verification"
      };
    }

    const rpc = (await response.json().catch(() => null)) as {
      result?: {
        slot?: number;
        meta?: { err?: unknown; logMessages?: string[] } | null;
        transaction?: {
          message?: {
            accountKeys?: Array<{ pubkey?: string; signer?: boolean } | string>;
            instructions?: Array<{ programId?: string }>;
          };
        };
      } | null;
    } | null;

    const tx = rpc?.result;
    if (!tx || !tx.meta) {
      return {
        verified: false,
        slot: 0,
        events: [],
        reason: "Transaction is not finalized on Solana yet"
      };
    }
    if (tx.meta.err !== null && tx.meta.err !== undefined) {
      return {
        verified: false,
        slot: tx.slot ?? 0,
        events: [],
        reason: "Transaction failed on-chain"
      };
    }

    const instructions = tx.transaction?.message?.accountKeys ? tx.transaction?.message?.instructions ?? [] : [];
    const invokesEncore = instructions.some((ix) => ix.programId === this.programId);
    if (!invokesEncore) {
      return {
        verified: false,
        slot: tx.slot ?? 0,
        events: [],
        reason: "Transaction did not invoke the Encore program"
      };
    }

    const accountKeys = tx.transaction?.message?.accountKeys ?? [];
    const pubkeyList = accountKeys.map((k) => (typeof k === "string" ? k : k.pubkey ?? ""));

    if (params.expectedSigner) {
      const signedByExpected = accountKeys.some((k) =>
        typeof k === "string" ? false : k.pubkey === params.expectedSigner && Boolean(k.signer)
      );
      if (!signedByExpected) {
        return {
          verified: false,
          slot: tx.slot ?? 0,
          events: [],
          reason: "Transaction was not signed by the expected wallet"
        };
      }
    }

    for (const reqAcct of params.expectedAccounts ?? []) {
      if (!pubkeyList.includes(reqAcct)) {
        return {
          verified: false,
          slot: tx.slot ?? 0,
          events: [],
          reason: `Transaction missing expected account ${reqAcct}`
        };
      }
    }

    const events = extractEncoreEventsFromLogs(tx.meta.logMessages ?? []);
    return {
      verified: true,
      slot: tx.slot ?? 0,
      events
    };
  }

  async verifyFinalizedDeposit(params: {
    signature: string;
    expectedDestination: string;
    minimumAmountSmallestUnits: string;
  }): Promise<{
    verified: boolean;
    slot: number;
    actualAmountSmallestUnits: string;
    reason?: string;
  }> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          params.signature,
          {
            encoding: "jsonParsed",
            commitment: "finalized",
            maxSupportedTransactionVersion: 0
          }
        ]
      })
    }).catch(() => null);

    if (!response || !response.ok) {
      return {
        verified: false,
        slot: 0,
        actualAmountSmallestUnits: "0",
        reason: "Unable to reach Solana RPC to verify finalized deposit"
      };
    }

    const rpc = (await response.json().catch(() => null)) as {
      result?: {
        slot?: number;
        meta?: {
          err?: unknown;
          preTokenBalances?: Array<{
            accountIndex?: number;
            owner?: string;
            uiTokenAmount?: { amount?: string };
          }>;
          postTokenBalances?: Array<{
            accountIndex?: number;
            owner?: string;
            uiTokenAmount?: { amount?: string };
          }>;
        } | null;
        transaction?: {
          message?: {
            accountKeys?: Array<{ pubkey?: string } | string>;
          };
        };
      } | null;
    } | null;

    const tx = rpc?.result;
    if (!tx || !tx.meta) {
      return {
        verified: false,
        slot: 0,
        actualAmountSmallestUnits: "0",
        reason: "Deposit transaction is not finalized on Solana"
      };
    }
    if (tx.meta.err !== null && tx.meta.err !== undefined) {
      return {
        verified: false,
        slot: tx.slot ?? 0,
        actualAmountSmallestUnits: "0",
        reason: "Deposit transaction failed on-chain"
      };
    }

    const accountKeys = (tx.transaction?.message?.accountKeys ?? []).map((k) =>
      typeof k === "string" ? k : k.pubkey ?? ""
    );

    const preByIndex = new Map<number, bigint>();
    for (const b of tx.meta.preTokenBalances ?? []) {
      if (typeof b.accountIndex === "number") {
        preByIndex.set(b.accountIndex, BigInt(b.uiTokenAmount?.amount ?? "0"));
      }
    }
    let credited = 0n;
    for (const b of tx.meta.postTokenBalances ?? []) {
      const idx = b.accountIndex;
      const acctKey = typeof idx === "number" ? accountKeys[idx] : undefined;
      if (b.owner === params.expectedDestination || acctKey === params.expectedDestination) {
        const post = BigInt(b.uiTokenAmount?.amount ?? "0");
        const pre = typeof idx === "number" ? (preByIndex.get(idx) ?? 0n) : 0n;
        if (post > pre) credited += post - pre;
      }
    }

    const minimum = BigInt(params.minimumAmountSmallestUnits);
    if (credited < minimum) {
      return {
        verified: false,
        slot: tx.slot ?? 0,
        actualAmountSmallestUnits: credited.toString(),
        reason: `Verified deposit (${credited.toString()}) is below required ${minimum.toString()} smallest units`
      };
    }

    return {
      verified: true,
      slot: tx.slot ?? 0,
      actualAmountSmallestUnits: credited.toString()
    };
  }
}
