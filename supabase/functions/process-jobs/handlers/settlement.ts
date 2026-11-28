import { alreadyProcessed } from "../../_shared/idempotency.ts";
import { logJobEvent } from "../../_shared/logger.ts";

declare const Deno: { env: { get(key: string): string | undefined } } | undefined;

function readEnv(key: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno?.env) {
    return Deno.env.get(key);
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

export interface SettlementJobPayload {
  idempotencyKey?: string;
  signature?: string;
  finality?: "confirmed" | "finalized";
  eventType?: string;
  cluster?: string;
}

// Settlement queue handler: idempotent Solana finality verification & receipt projection
export async function handleSettlementJob(
  payload: SettlementJobPayload
): Promise<{ ok: boolean; skipped?: boolean; slot?: number; signature?: string }> {
  const signature = payload.signature ?? "";
  const key = payload.idempotencyKey ?? signature;
  if (!key || !signature) {
    throw new Error("Settlement job missing idempotencyKey/signature");
  }

  if (await alreadyProcessed(key)) {
    return { ok: true, skipped: true };
  }

  const rpcUrl = readEnv("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com";
  const rpcRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        {
          encoding: "jsonParsed",
          commitment: "finalized",
          maxSupportedTransactionVersion: 0
        }
      ]
    })
  });
  if (!rpcRes.ok) {
    throw new Error(`Solana RPC error (${rpcRes.status}) while reconciling ${signature}`);
  }

  const rpcJson = (await rpcRes.json()) as {
    result?: {
      slot?: number;
      meta?: { err?: unknown; logMessages?: string[] } | null;
    } | null;
  };
  const tx = rpcJson.result;
  if (!tx || !tx.meta) {
    throw new Error(`Transaction ${signature} is not finalized on Solana`);
  }
  if (tx.meta.err !== null && tx.meta.err !== undefined) {
    throw new Error(`Transaction ${signature} failed on-chain: ${JSON.stringify(tx.meta.err)}`);
  }

  const slot = tx.slot ?? 0;
  const supabaseUrl = readEnv("SUPABASE_URL") ?? readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY") ?? readEnv("SUPABASE_SECRET_KEY");

  if (supabaseUrl && serviceKey) {
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/chain_events`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        signature,
        event_index: 0,
        slot,
        event_type: payload.eventType ?? "settlement_reconciled",
        payload: {
          signature,
          slot,
          logMessages: tx.meta.logMessages ?? []
        },
        finality: "finalized"
      })
    });
    if (!upsertRes.ok) {
      const detail = await upsertRes.text().catch(() => "");
      throw new Error(`Failed to persist finalized chain_event (${upsertRes.status}): ${detail}`);
    }

    await fetch(`${supabaseUrl}/rest/v1/chain_indexer_cursor`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        cluster: payload.cluster ?? "devnet",
        last_signature: signature,
        last_slot: slot
      })
    });
  }

  logJobEvent("info", "settlement.reconciled", {
    signature,
    slot,
    finality: "finalized"
  });
  return { ok: true, slot, signature };
}
