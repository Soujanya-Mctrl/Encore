import { alreadyProcessed } from "../../_shared/idempotency.ts";
import { logJobEvent } from "../../_shared/logger.ts";

// Settlement queue handler: idempotent transaction indexing & finality reconciliation
export async function handleSettlementJob(payload: {
  idempotencyKey?: string;
  signature?: string;
  finality?: "confirmed" | "finalized";
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const key = payload.idempotencyKey ?? payload.signature ?? "";
  if (!key) throw new Error("Settlement job missing idempotencyKey/signature");

  if (await alreadyProcessed(key)) {
    return { ok: true, skipped: true };
  }

  logJobEvent("info", "settlement.reconcile", {
    signature: payload.signature,
    finality: payload.finality ?? "confirmed"
  });
  return { ok: true };
}
