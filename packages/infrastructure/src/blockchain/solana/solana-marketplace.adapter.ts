import { PublicKey } from "@solana/web3.js";
import type { MarketplaceChainPort, UnsignedChainTransaction } from "@encore/core";
import {
  buildUnsignedMemoAnchorEnvelope,
  DEFAULT_ENCORE_PROGRAM_ID,
  deriveMarketplaceAddresses
} from "@encore/solana-client";

export class SolanaMarketplaceChainAdapter implements MarketplaceChainPort {
  constructor(
    private readonly programId = DEFAULT_ENCORE_PROGRAM_ID,
    private readonly rpcUrl = process.env.SOLANA_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      "https://api.devnet.solana.com"
  ) {}

  async buildDirectSupportTx(params: {
    payerWallet: string;
    artistWallet: string;
    trackId: string;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
    nonce: string;
  }): Promise<UnsignedChainTransaction> {
    const addrs = deriveMarketplaceAddresses({
      programId: this.programId,
      payerWallet: params.payerWallet,
      artistWallet: params.artistWallet,
      trackId: params.trackId,
      nonce: BigInt(params.nonce)
    });

    const serializedBase64 = buildUnsignedMemoAnchorEnvelope({
      payer: params.payerWallet,
      programId: this.programId,
      instructionName: "direct_support",
      accountMetas: [
        { pubkey: addrs.trackPda, isSigner: false, isWritable: false },
        ...(addrs.receiptPda
          ? [{ pubkey: addrs.receiptPda, isSigner: false, isWritable: true }]
          : [])
      ],
      payloadJson: {
        trackId: params.trackId,
        version: params.version,
        manifestHash: params.manifestHash,
        amount: params.amountSmallestUnits,
        nonce: params.nonce
      }
    });

    return {
      instructionName: "direct_support",
      serializedBase64,
      expectedSigners: [params.payerWallet],
      programId: this.programId
    };
  }

  async buildPrimaryPassPurchaseTx(params: {
    buyerWallet: string;
    artistWallet: string;
    seriesId: string;
    serial: number;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const addrs = deriveMarketplaceAddresses({
      programId: this.programId,
      payerWallet: params.buyerWallet,
      artistWallet: params.artistWallet,
      trackId: params.seriesId,
      seriesId: params.seriesId,
      serial: params.serial
    });

    const serializedBase64 = buildUnsignedMemoAnchorEnvelope({
      payer: params.buyerWallet,
      programId: this.programId,
      instructionName: "buy_primary",
      accountMetas: [
        ...(addrs.seriesPda
          ? [{ pubkey: addrs.seriesPda, isSigner: false, isWritable: true }]
          : []),
        ...(addrs.passPda
          ? [{ pubkey: addrs.passPda, isSigner: false, isWritable: true }]
          : [])
      ],
      payloadJson: params
    });

    return {
      instructionName: "buy_primary",
      serializedBase64,
      expectedSigners: [params.buyerWallet],
      programId: this.programId
    };
  }

  async buildListingPurchaseTx(params: {
    buyerWallet: string;
    sellerWallet: string;
    artistWallet: string;
    passId: string;
    nonce: number;
    version: number;
    manifestHash: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const addrs = deriveMarketplaceAddresses({
      programId: this.programId,
      payerWallet: params.buyerWallet,
      artistWallet: params.artistWallet,
      trackId: params.passId
    });

    const serializedBase64 = buildUnsignedMemoAnchorEnvelope({
      payer: params.buyerWallet,
      programId: this.programId,
      instructionName: "buy_listing",
      accountMetas: [{ pubkey: addrs.trackPda, isSigner: false, isWritable: false }],
      payloadJson: params
    });

    return {
      instructionName: "buy_listing",
      serializedBase64,
      expectedSigners: [params.buyerWallet],
      programId: this.programId
    };
  }

  async buildCampaignPledgeTx(params: {
    payerWallet: string;
    vaultAddress: string;
    campaignId: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const serializedBase64 = buildUnsignedMemoAnchorEnvelope({
      payer: params.payerWallet,
      programId: this.programId,
      instructionName: "pledge_campaign",
      accountMetas: [{ pubkey: new PublicKey(params.vaultAddress), isSigner: false, isWritable: true }],
      payloadJson: params
    });
    return {
      instructionName: "pledge_campaign",
      serializedBase64,
      expectedSigners: [params.payerWallet],
      programId: this.programId
    };
  }

  async buildCampaignRefundTx(params: {
    claimerWallet: string;
    vaultAddress: string;
    campaignId: string;
    amountSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const serializedBase64 = buildUnsignedMemoAnchorEnvelope({
      payer: params.claimerWallet,
      programId: this.programId,
      instructionName: "refund_campaign",
      accountMetas: [{ pubkey: new PublicKey(params.vaultAddress), isSigner: false, isWritable: true }],
      payloadJson: params
    });
    return {
      instructionName: "refund_campaign",
      serializedBase64,
      expectedSigners: [params.claimerWallet],
      programId: this.programId
    };
  }

  async buildSpotBuyTx(params: {
    buyerWallet: string;
    sellerWallet: string;
    spotListingId: string;
    campaignId: string;
    units: number;
    unitPriceSmallestUnits: string;
    totalSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const serializedBase64 = buildUnsignedMemoAnchorEnvelope({
      payer: params.buyerWallet,
      programId: this.programId,
      instructionName: "buy_spot",
      accountMetas: [{ pubkey: new PublicKey(params.sellerWallet), isSigner: false, isWritable: true }],
      payloadJson: params
    });
    return {
      instructionName: "buy_spot",
      serializedBase64,
      expectedSigners: [params.buyerWallet],
      programId: this.programId
    };
  }

  async buildDistributionClaimTx(params: {
    claimerWallet: string;
    vaultAddress: string;
    cycleId: string;
    campaignId: string;
    payoutSmallestUnits: string;
  }): Promise<UnsignedChainTransaction> {
    const serializedBase64 = buildUnsignedMemoAnchorEnvelope({
      payer: params.claimerWallet,
      programId: this.programId,
      instructionName: "claim_distribution",
      accountMetas: [{ pubkey: new PublicKey(params.vaultAddress), isSigner: false, isWritable: true }],
      payloadJson: params
    });
    return {
      instructionName: "claim_distribution",
      serializedBase64,
      expectedSigners: [params.claimerWallet],
      programId: this.programId
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
          preTokenBalances?: Array<{ owner?: string; uiTokenAmount?: { amount?: string } }>;
          postTokenBalances?: Array<{ owner?: string; uiTokenAmount?: { amount?: string } }>;
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

    const preMap = new Map<string, bigint>();
    for (const b of tx.meta.preTokenBalances ?? []) {
      if (b.owner) preMap.set(b.owner, BigInt(b.uiTokenAmount?.amount ?? "0"));
    }
    let credited = 0n;
    for (const b of tx.meta.postTokenBalances ?? []) {
      if (b.owner === params.expectedDestination) {
        const post = BigInt(b.uiTokenAmount?.amount ?? "0");
        const pre = preMap.get(b.owner) ?? 0n;
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
