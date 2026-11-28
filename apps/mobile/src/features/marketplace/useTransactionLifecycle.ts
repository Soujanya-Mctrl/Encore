import { useCallback, useEffect, useState } from "react";
import type { TransactionLifecycleState } from "@encore/contracts";
import { encoreApiFetch } from "../../lib/api-client";

export interface PendingTxRecord {
  intentId: string;
  signature: string;
  kind: "tip" | "pass_buy" | "pass_resale" | "pledge" | "spot_buy" | "distribution_claim";
  expiresAt: string;
  state: TransactionLifecycleState;
  errorMessage?: string;
}

const STORAGE_KEY = "encore.pending_tx_record.v1";

function readStoredRecord(): PendingTxRecord | null {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis && globalThis.localStorage) {
      const raw = globalThis.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PendingTxRecord) : null;
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  return null;
}

function writeStoredRecord(record: PendingTxRecord | null): void {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis && globalThis.localStorage) {
      if (record) {
        globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      } else {
        globalThis.localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage write errors
  }
}

export function useTransactionLifecycle(bearerToken?: string | null) {
  const [record, setRecord] = useState<PendingTxRecord | null>(() => readStoredRecord());

  const updateRecord = useCallback((next: PendingTxRecord | null) => {
    setRecord(next);
    writeStoredRecord(next);
  }, []);

  const refreshReceipt = useCallback(
    async (target: PendingTxRecord) => {
      if (Date.now() > new Date(target.expiresAt).getTime()) {
        updateRecord({ ...target, state: "expired" });
        return;
      }
      try {
        const res = await encoreApiFetch<{ receipt?: { signature: string } | null }>(
          `/api/v1/receipts/${encodeURIComponent(target.signature)}`,
          { bearerToken }
        );
        if (res.receipt) {
          updateRecord({ ...target, state: "finalized" });
        }
      } catch {
        // Keep pending until finalized or expired
      }
    },
    [bearerToken, updateRecord]
  );

  useEffect(() => {
    if (!record || (record.state !== "submitted" && record.state !== "pending")) return;
    const initial = setTimeout(() => { void refreshReceipt(record); }, 0);
    const timer = setInterval(() => {
      void refreshReceipt(record);
    }, 4000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [record, refreshReceipt]);

  const markReview = useCallback(
    (intentId: string, kind: PendingTxRecord["kind"], expiresAt: string) => {
      updateRecord({ intentId, signature: "", kind, expiresAt, state: "review" });
    },
    [updateRecord]
  );

  const markWalletPrompt = useCallback(() => {
    if (!record) return;
    updateRecord({ ...record, state: "wallet" });
  }, [record, updateRecord]);

  const markSubmitted = useCallback(
    (signature: string) => {
      if (!record) return;
      updateRecord({ ...record, signature, state: "pending" });
    },
    [record, updateRecord]
  );

  const markFailed = useCallback(
    (errorMessage: string) => {
      if (!record) return;
      updateRecord({ ...record, state: "failed", errorMessage });
    },
    [record, updateRecord]
  );

  const clear = useCallback(() => updateRecord(null), [updateRecord]);

  return {
    txRecord: record,
    markReview,
    markWalletPrompt,
    markSubmitted,
    markFailed,
    clear,
    refreshReceipt
  };
}
