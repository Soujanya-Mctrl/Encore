import { createClient } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";
import { DEFAULT_ENCORE_PROGRAM_ID, extractEncoreEventsFromLogs } from "@encore/solana-client";
import { SolanaMarketplaceChainAdapter } from "../packages/infrastructure/src/blockchain/solana/solana-marketplace.adapter.js";

function readFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const programId =
    readFlag("--program-id") ??
    process.env.NEXT_PUBLIC_ENCORE_PROGRAM_ID ??
    DEFAULT_ENCORE_PROGRAM_ID;
  const rpcUrl =
    readFlag("--rpc-url") ??
    process.env.SOLANA_RPC_URL ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    "https://api.devnet.solana.com";
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  const singleSig = readFlag("--signature");
  const expectedInstruction = readFlag("--instruction");
  const limit = Number(readFlag("--limit") ?? "20");

  const adapter = new SolanaMarketplaceChainAdapter({
    programId,
    rpcUrl,
    cluster,
    offlineBlockhashFallback: false
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase =
    supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        })
      : null;

  let signatures: string[] = [];
  if (singleSig) {
    signatures = [singleSig];
  } else {
    const infos = await adapter.connection.getSignaturesForAddress(new PublicKey(programId), {
      limit
    });
    signatures = infos.filter((i) => !i.err).map((i) => i.signature);
  }

  let reconciled = 0;
  let lastSlot = 0;
  let lastSignature: string | null = null;

  for (const sig of signatures) {
    if (expectedInstruction) {
      const check = await adapter.verifyFinalizedMarketplaceTx({
        signature: sig,
        expectedInstruction
      });
      if (!check.verified) {
        console.warn(`Skipped ${sig}: ${check.reason}`);
        continue;
      }
      lastSlot = Math.max(lastSlot, check.slot);
      lastSignature = sig;
      if (supabase) {
        for (let idx = 0; idx < check.events.length; idx++) {
          const ev = check.events[idx];
          await supabase.from("chain_events").upsert(
            {
              signature: sig,
              event_index: idx,
              slot: check.slot,
              event_type: ev.name,
              payload: { dataBase64: ev.dataBase64, instruction: expectedInstruction },
              finality: "finalized"
            },
            { onConflict: "signature,event_index" }
          );
        }
      }
      reconciled++;
      console.log(JSON.stringify({ signature: sig, slot: check.slot, events: check.events.length }));
      continue;
    }

    const tx = await adapter.connection.getTransaction(sig, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0
    });
    if (!tx || tx.meta?.err) continue;

    const events = extractEncoreEventsFromLogs(tx.meta?.logMessages ?? []);
    lastSlot = Math.max(lastSlot, tx.slot);
    lastSignature = sig;
    if (supabase) {
      const rows =
        events.length > 0
          ? events.map((ev, idx) => ({
              signature: sig,
              event_index: idx,
              slot: tx.slot,
              event_type: ev.name,
              payload: { dataBase64: ev.dataBase64 },
              finality: "finalized"
            }))
          : [
              {
                signature: sig,
                event_index: 0,
                slot: tx.slot,
                event_type: "program_tx",
                payload: { fee: tx.meta?.fee ?? 0 },
                finality: "finalized"
              }
            ];
      for (const row of rows) {
        await supabase.from("chain_events").upsert(row, { onConflict: "signature,event_index" });
      }
    }
    reconciled++;
    console.log(JSON.stringify({ signature: sig, slot: tx.slot, events: events.length }));
  }

  if (supabase && lastSignature) {
    await supabase.from("chain_indexer_cursor").upsert({
      cluster,
      last_signature: lastSignature,
      last_slot: lastSlot,
      updated_at: new Date().toISOString()
    });
  }

  console.log(`Reconciled ${reconciled}/${signatures.length} finalized transactions on ${cluster}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
