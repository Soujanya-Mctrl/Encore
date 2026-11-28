"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEncoreAuth } from "@/providers/pollar-provider";
export function AnchorButton({ id }: { id: string }) {
  const { discoveredWallets } = useEncoreAuth(),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [signature, setSignature] = useState("");
  const router = useRouter();
  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      const wallet = discoveredWallets[selected];
      if (!wallet)
        throw new Error(
          "Connect a Solana Wallet Standard wallet to sign this registry transaction",
        );
      const { address } = await wallet.connect();
      async function post(body: unknown) {
        const r = await fetch(`/api/v1/tracks/${id}/anchor`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address, ...(body as object) }),
        });
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        return b;
      }
      let sig = signature;
      if (!sig) {
        const prepared = await post({});
        setMessage(
          "Review and approve the devnet registry transaction in your wallet.",
        );
        sig = prepared.existingSignature ?? "";
        for (const encoded of prepared.transactions) {
          const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
          const signed = await wallet.signSolanaTransaction(
            bytes,
            "solana:devnet",
          );
          const sent = await post({
            signedTransaction: btoa(String.fromCharCode(...signed)),
          });
          sig = sent.signature;
          // Sequential chunks share immutable history; confirm each before the next.
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        setSignature(sig);
      }
      setMessage("Waiting for finalized registry confirmation…");
      let complete = false;
      for (let i = 0; i < 25; i++) {
        try {
          await post({ signature: sig });
          complete = true;
          break;
        } catch (e) {
          if (i === 24) throw e;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (complete) {
        setMessage("Published with a finalized Music Passport.");
        router.refresh();
      }
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not publish. Retry confirmation.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="my-6 space-y-3">
      <p>
        Approved. Sign the Passport commitment on Solana devnet to publish. Your
        wallet pays test-SOL network fees.
      </p>
      <select
        aria-label="Registry signing wallet"
        className="bg-slate-800 p-3 rounded"
        onChange={(e) => setSelected(Number(e.target.value))}
      >
        {discoveredWallets.map((w, i) => (
          <option key={i} value={i}>
            {w.meta.label}
          </option>
        ))}
      </select>
      <button
        disabled={busy}
        onClick={publish}
        className="bg-violet-600 p-3 rounded ml-3 disabled:opacity-50"
      >
        {busy
          ? "Publishing…"
          : signature
            ? "Retry confirmation"
            : "Sign Passport & publish"}
      </button>
      {message && <p role="status">{message}</p>}
      {signature && (
        <a
          className="block break-all"
          href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
        >
          View transaction
        </a>
      )}
    </section>
  );
}
