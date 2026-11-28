"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { LICENSE_USES, RIGHTS_PROVIDERS, type DiscoveryTrack, type RightsAction, type RightsRecord, type RightsWorkspace } from "@encore/contracts";
import { useRouter } from "next/navigation";

const field = "w-full rounded border border-slate-600 bg-slate-900 p-2";
const button = "rounded bg-violet-700 px-3 py-2 disabled:opacity-50";
const text = (data: FormData, key: string) => String(data.get(key) ?? "");
const check = (data: FormData, key: string) => data.has(key);

async function getWorkspace(query: string) {
  const response = await fetch(`/api/v1/rights${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the rights workspace.");
  return response.json() as Promise<RightsWorkspace>;
}

async function send(action: RightsAction) {
  const response = await fetch("/api/v1/rights", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action) });
  if (!response.ok) throw new Error((await response.json()).error ?? "Rights action failed");
}

function useRightsActions(refresh: () => void) {
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  async function execute(action: RightsAction, success: string) {
    setBusy(true);
    setFeedback("");
    try {
      await send(action);
      setFeedback(success);
      refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Rights action failed.");
    } finally {
      setBusy(false);
    }
  }
  return { feedback, busy, execute };
}

export function TrackRightsPanel({ track, owner, reviewer, signedIn }: {
  track: DiscoveryTrack; owner: boolean; reviewer: boolean; signedIn: boolean;
}) {
  const router = useRouter();
  const [record, setRecord] = useState<RightsRecord>();
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [provider, setProvider] = useState("original");
  const [requestId, setRequestId] = useState("");
  const { busy, feedback, execute } = useRightsActions(() => {
    setRevision((n) => n + 1);
    router.refresh();
  });
  useEffect(() => {
    if (!owner && !reviewer) return;
    let current = true;
    getWorkspace(`?trackId=${track.id}`).then((workspace) => {
      if (current) { setRecord(workspace.records[0]); setLoadError(""); }
    }, (error: Error) => { if (current) setLoadError(error.message); });
    return () => { current = false; };
  }, [owner, reviewer, track.id, track.manifest.version, revision]);

  const target = { trackId: track.id, version: track.manifest.version };
  function declare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const generation = text(data, "generatedAt");
    void execute({ action: "submit", ...target, declaration: {
      provider: text(data, "provider") as (typeof RIGHTS_PROVIDERS)[number],
      masterAuthority: check(data, "masterAuthority"), compositionAuthority: check(data, "compositionAuthority"),
      contributorsCleared: check(data, "contributorsCleared"), inputsCleared: check(data, "inputsCleared"),
      worldwidePreview: check(data, "worldwidePreview"), writtenHostingPermission: check(data, "writtenHostingPermission"),
      evidenceDocument: text(data, "evidenceDocument"),
      validUntil: new Date(text(data, "validUntil") + "T23:59:59Z").toISOString(),
      ...(generation ? { generatedAt: new Date(generation + "T00:00:00Z").toISOString() } : {}),
      ...(text(data, "providerPlan") ? { providerPlan: text(data, "providerPlan") as "free" | "paid" | "custom" | "unknown" } : {}),
      ...(text(data, "termsDigest") ? { termsDigest: text(data, "termsDigest") } : {}),
      ...(text(data, "providerListing") ? { providerListing: text(data, "providerListing") } : {}),
      licenseUses: data.getAll("licenseUses") as (typeof LICENSE_USES)[number][],
    } }, "Rights file submitted for review.");
  }
  function inquire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = requestId || crypto.randomUUID();
    setRequestId(id);
    void execute({ action: "request", ...target, requestId: id, use: text(data, "use") as (typeof LICENSE_USES)[number],
      territory: text(data, "territory"), termMonths: Number(text(data, "termMonths")), details: text(data, "details"),
    }, "Inquiry sent. Track replies in the rights workspace.");
  }

  return <section className="mt-8 grid gap-4 rounded-2xl border border-slate-700 p-5" aria-label="Rights and licensing">
    <h2 className="text-xl font-semibold">Rights and licensing</h2>
    <p>{track.rights.preview ? "Hosted preview permitted" : "Hosted preview unavailable"}</p>
    {track.rights.externalUrl && <a className="text-violet-300 underline" href={track.rights.externalUrl} target="_blank" rel="noreferrer">Open official provider listing</a>}
    {loadError && <p role="alert">{loadError}</p>}
    {record && <p>Rights file v{record.revision} · {record.status}{record.review_reason ? ` · ${record.review_reason}` : ""}</p>}
    {owner && record?.status === "approved" && <button type="button" className={button} disabled={busy}
      onClick={() => execute({ action: "withdraw", ...target, revision: record.revision }, "Permission withdrawn.")}>Withdraw permissions</button>}
    {owner && record?.status !== "approved" && <details>
      <summary className="cursor-pointer text-violet-300">Submit rights documentation</summary>
      <form className="mt-3 grid gap-3" onSubmit={declare}>
        <label>Source provider<select className={field} name="provider" value={provider} onChange={(event) => setProvider(event.target.value)}>{RIGHTS_PROVIDERS.map((item) => <option key={item}>{item}</option>)}</select></label>
        {provider !== "original" && <>
          <label>Provider plan at the relevant release or download date<select name="providerPlan" className={field}><option>unknown</option><option>free</option><option>paid</option><option>custom</option></select></label>
          <label>Generation date<input className={field} type="date" name="generatedAt" /></label>
          <label>Provider terms SHA-256<input className={field} name="termsDigest" pattern="[0-9a-f]{64}" /></label>
          <label>Official listing URL<input className={field} name="providerListing" type="url" maxLength={512} /></label>
          <label><input type="checkbox" name="writtenHostingPermission" /> Written platform hosting permission</label>
        </>}
        <label><input type="checkbox" name="masterAuthority" /> Authority over the master recording</label>
        <label><input type="checkbox" name="compositionAuthority" /> Authority over the composition</label>
        <label><input type="checkbox" name="contributorsCleared" /> Collaborator permissions cleared</label>
        <label><input type="checkbox" name="inputsCleared" /> Samples and source inputs cleared</label>
        <label><input type="checkbox" name="worldwidePreview" /> Worldwide permission for Encore to host this preview</label>
        <label>Permission expires<input type="date" name="validUntil" required className={field} /></label>
        <label>Private documentation<textarea className={field} name="evidenceDocument" rows={6} minLength={20} maxLength={16000} required placeholder="Include the rights holders, signing authority, scope and provider authorizations." /></label>
        <fieldset><legend>Available uses for original music inquiries</legend>
          {LICENSE_USES.map((use) => <label className="mr-3 inline-block" key={use}><input type="checkbox" name="licenseUses" value={use} /> {use}</label>)}
        </fieldset>
        <button className={button} disabled={busy}>Submit for rights review</button>
      </form>
    </details>}
    {reviewer && record && <details>
      <summary className="cursor-pointer text-violet-300">View private rights file</summary>
      <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-slate-900 p-3 text-sm">{JSON.stringify(record.declaration, null, 2)}</pre>
      {record.status === "pending" && <form className="mt-3 grid gap-3" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        void execute({ action: "review", ...target, revision: record.revision, decision: text(data, "decision") as "approved" | "rejected", reason: text(data, "reason") }, "Rights review recorded.");
      }}>
        <label>Review reason<textarea className={field} name="reason" minLength={3} maxLength={500} required /></label>
        <div className="flex gap-2"><button className={button} disabled={busy} name="decision" value="approved">Approve documented permissions</button>
          <button className={button} disabled={busy} name="decision" value="rejected">Reject documentation</button></div>
      </form>}
    </details>}
    {!owner && track.status === "published" && track.rights.licenseUses.length > 0 && (signedIn
      ? <form className="grid gap-3" onSubmit={inquire} onChange={() => setRequestId("")}>
        <h3 className="font-semibold">Ask about a license</h3>
        <p className="text-sm text-slate-300">An inquiry starts a discussion with the rights holder. Usage requires a separate signed agreement.</p>
        <label>Use<select name="use" className={field}>{track.rights.licenseUses.map((use) => <option key={use}>{use}</option>)}</select></label>
        <label>Territory<input name="territory" className={field} required minLength={2} maxLength={80} /></label>
        <label>Term in months<input name="termMonths" className={field} type="number" min={1} max={120} defaultValue={12} required /></label>
        <label>Project details<textarea name="details" className={field} required minLength={10} maxLength={1000} /></label>
        <button className={button} disabled={busy}>Send license inquiry</button>
      </form>
      : <Link href="/login" className="text-violet-300 underline">Sign in to send a license inquiry</Link>)}
    {feedback && <p role="status" className="text-sm">{feedback}</p>}
  </section>;
}

export function RightsInbox({ reviewer }: { reviewer: boolean }) {
  const [workspace, setWorkspace] = useState<RightsWorkspace>();
  const [loadError, setLoadError] = useState("");
  const [tick, setTick] = useState(0);
  const { busy, feedback, execute } = useRightsActions(() => setTick((count) => count + 1));
  useEffect(() => {
    let current = true;
    getWorkspace(reviewer ? "?review=1" : "").then((result) => {
      if (current) { setWorkspace(result); setLoadError(""); }
    }, (error: Error) => { if (current) setLoadError(error.message); });
    return () => { current = false; };
  }, [reviewer, tick]);
  return <div className="mt-6 space-y-5">
    {loadError && <p role="alert">{loadError}</p>}
    {!workspace && !loadError && <p>Loading…</p>}
    <section className="space-y-2"><h2 className="text-lg font-semibold">{reviewer ? "Pending rights reviews" : "My rights files"}</h2>
      {workspace?.records.map((record) => <div key={record.track_id}><Link className="text-violet-300 underline" href={`/tracks/${record.track_id}`}>Open Passport v{record.passport_version}</Link> · {record.status}</div>)}
      {workspace?.records.length === 0 && <p>No rights files to show.</p>}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">License inquiries</h2>
      {workspace?.inquiries.map((item) => <article key={item.id} className="rounded-xl border border-slate-700 p-4">
        <h3>{item.title} · {item.direction}</h3><p>{item.scope.use} · {item.scope.territory} · {item.scope.termMonths} months</p>
        <p>{item.scope.details}</p><p className="text-slate-300">{item.status.replaceAll("_", " ")}{item.response ? ` · ${item.response}` : ""}</p>
        {item.direction === "received" && item.status === "pending" && <form className="mt-3 grid gap-2" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
          void execute({ action: "respond", requestId: item.id, decision: text(data, "decision") as "accepted_for_discussion" | "declined", note: text(data, "note") }, "Response recorded.");
        }}>
          <label>Response<input className={field} name="note" required minLength={3} maxLength={500} /></label>
          <div className="flex gap-2"><button className={button} disabled={busy} name="decision" value="accepted_for_discussion">Accept for discussion</button>
            <button className={button} disabled={busy} name="decision" value="declined">Decline</button></div>
        </form>}
      </article>)}
      {workspace?.inquiries.length === 0 && <p>No license inquiries yet.</p>}
    </section>
    {feedback && <p role="status">{feedback}</p>}
  </div>;
}
