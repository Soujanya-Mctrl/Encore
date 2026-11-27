import { describe, expect, it } from "vitest";
import { SolanaWalletStandardAdapter } from "@pollar/solana-wallet-standard-adapter";
import { Keypair, Transaction, TransactionInstruction } from "@solana/web3.js";

describe("Pollar external Solana adapter", () => {
  it("signs a custom program transaction without changing its instruction", async () => {
    const payer = Keypair.generate();
    const program = Keypair.generate().publicKey;
    const account = { address: payer.publicKey.toBase58(), publicKey: payer.publicKey.toBytes(),
      chains: ["solana:devnet"], features: ["solana:signTransaction"] };
    const wallet = { version: "1.0.0", name: "Encore Test Wallet", icon: "data:image/svg+xml;base64,PHN2Zy8+",
      chains: ["solana:devnet"], accounts: [account], features: {
        "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [account] }) },
        "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy"],
          signTransaction: async (...inputs: { transaction: Uint8Array; chain: string }[]) => inputs.map((input) => {
            expect(input.chain).toBe("solana:devnet");
            const transaction = Transaction.from(input.transaction);
            transaction.partialSign(payer);
            return { signedTransaction: transaction.serialize() };
          }) }
      } };
    const adapter = new SolanaWalletStandardAdapter(wallet as unknown as ConstructorParameters<typeof SolanaWalletStandardAdapter>[0], "solana:encore-test", { label: "Encore Test Wallet" });
    await adapter.connect();
    const transaction = new Transaction({ feePayer: payer.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58() }).add(
      new TransactionInstruction({ programId: program, keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }], data: Buffer.from([1, 2, 3, 4]) }));
    const originalMessage = transaction.serializeMessage();
    const unsigned = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
    const signed = Transaction.from(await adapter.signSolanaTransaction(unsigned, "solana:devnet"));
    expect(signed.verifySignatures()).toBe(true);
    expect(signed.serializeMessage()).toEqual(originalMessage);
    expect(signed.instructions[0]?.programId.equals(program)).toBe(true);
  });
});
