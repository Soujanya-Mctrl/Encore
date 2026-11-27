import { Connection, Keypair, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { createMint, getAccount, getMint, getOrCreateAssociatedTokenAccount, mintTo, transferChecked } from "@solana/spl-token";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { devnetPayer, loadLocalEnvironment, required, saveEvidence } from "./phase-one-utils.ts";

loadLocalEnvironment();
const payer = devnetPayer();
const endpoint = required("NEXT_PUBLIC_SOLANA_RPC_URL");
const connection = new Connection(endpoint, "confirmed");
const evidence: Record<string, unknown> = { checkedAt: new Date().toISOString(), payer: payer.publicKey.toBase58(), cluster: "devnet" };
try {
  if (process.env.NEXT_PUBLIC_SOLANA_CLUSTER !== "devnet" ||
    await connection.getGenesisHash() !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") throw new Error("Refusing to run against a network other than Solana devnet");
  let balance = await connection.getBalance(payer.publicKey);
  if (balance < 50_000_000) {
    console.log(`Requesting test SOL for generated wallet ${payer.publicKey.toBase58()}`);
    const airdrop = await connection.requestAirdrop(payer.publicKey, 1_000_000_000);
    const latest = await connection.getLatestBlockhash();
    const confirmation = await connection.confirmTransaction({ signature: airdrop, ...latest }, "confirmed");
    if (confirmation.value.err) throw new Error("Devnet airdrop was not confirmed");
    evidence.airdrop = airdrop;
    balance = await connection.getBalance(payer.publicKey);
  }
  evidence.startingLamports = balance;
  const recipient = Keypair.generate();
  const sampleSignature = await sendAndConfirmTransaction(connection,
    new Transaction().add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: recipient.publicKey, lamports: 1_000_000 })), [payer]);
  evidence.sampleSolTransfer = sampleSignature;
  const mintFile = ".local/phase-one/test-mint.json";
  let mint;
  if (existsSync(mintFile)) {
    const { PublicKey } = await import("@solana/web3.js");
    mint = new PublicKey(JSON.parse(readFileSync(mintFile, "utf8")).mint);
  } else {
    mint = await createMint(connection, payer, payer.publicKey, null, 6);
    writeFileSync(mintFile, JSON.stringify({ mint: mint.toBase58() }, null, 2));
  }
  const mintInfo = await getMint(connection, mint);
  if (mintInfo.decimals !== 6 || !mintInfo.mintAuthority?.equals(payer.publicKey)) throw new Error("Unexpected test mint configuration");
  const source = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
  const target = await getOrCreateAssociatedTokenAccount(connection, payer, mint, recipient.publicKey);
  const mintSignature = await mintTo(connection, payer, mint, source.address, payer, 10_000_000n);
  const signature = await transferChecked(connection, payer, source.address, mint, target.address, payer, 1_000_000n, 6);
  const received = await getAccount(connection, target.address);
  if (received.amount !== 1_000_000n) throw new Error("Confirmed test-token amount does not match signed amount");
  evidence.status = "passed"; evidence.testMint = mint.toBase58(); evidence.decimals = mintInfo.decimals;
  evidence.mintTransaction = mintSignature; evidence.tokenTransfer = signature;
  evidence.tokenAmountSmallestUnits = "1000000";
  evidence.explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  const envFile = "apps/web/.env.local";
  const env = readFileSync(envFile, "utf8");
  writeFileSync(envFile, env.replace(/^NEXT_PUBLIC_TEST_USDC_MINT=.*$/m, `NEXT_PUBLIC_TEST_USDC_MINT=${mint.toBase58()}`));
  saveEvidence("solana", evidence); console.log(JSON.stringify(evidence, null, 2));
} catch {
  evidence.status = "blocked";
  evidence.reason = "Devnet funding or transaction request failed. Fund the generated test wallet with test SOL and rerun; no mainnet funds are used.";
  saveEvidence("solana", evidence); console.error(JSON.stringify(evidence, null, 2)); process.exitCode = 1;
}
