import type { MarketplaceChainPort, UnsignedChainTransaction } from "@encore/core";
import {
  buildUnsignedMemoAnchorEnvelope,
  DEFAULT_ENCORE_PROGRAM_ID,
  deriveMarketplaceAddresses
} from "@encore/solana-client";

export class SolanaMarketplaceChainAdapter implements MarketplaceChainPort {
  constructor(private readonly programId = DEFAULT_ENCORE_PROGRAM_ID) {}

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
}
