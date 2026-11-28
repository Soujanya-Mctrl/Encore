import { useState } from "react";
import { Link } from "expo-router";
import { Linking, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
function generateUUID(): string {
  try {
    const modules = (globalThis as any)?.expo?.modules;
    if (modules?.ExpoCrypto) {
      const Crypto = require("expo-crypto");
      if (Crypto?.randomUUID) return Crypto.randomUUID();
    }
  } catch {
    // fallback
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import { LICENSE_USES, RIGHTS_PROVIDERS, RightsActionSchema, type DiscoveryTrack, type LicenseInquiry, type RightsAction, type RightsDeclaration, type RightsRecord } from "@encore/contracts";
import { encoreColors as c } from "@/features/encore/ui/tokens";
import { rightsWorkspace, writeRights } from "./api";
import { useEncoreAccount } from "./account";
import { listStudioTracks } from "@/lib/encore-studio";
import { Action, Field, Heading, MusicPage, Note, formatLabel } from "./ui";

function useRightsMutation() {
  const { token } = useEncoreAccount();
  const cache = useQueryClient();
  const command = useMutation({ mutationFn: (action: RightsAction) => writeRights(RightsActionSchema.parse(action), token),
    onSuccess: async () => { await Promise.all([
      cache.invalidateQueries({ queryKey: ["rights"] }), cache.invalidateQueries({ queryKey: ["discovery"] }),
      cache.invalidateQueries({ queryKey: ["track"] }),
    ]); },
  });
  return { run: command.mutate, busy: command.isPending,
    message: command.isError ? command.error.message : command.isSuccess ? "Rights action recorded." : "" };
}

const blank = (): RightsDeclaration => ({
  provider: "original", masterAuthority: false, compositionAuthority: false, contributorsCleared: false,
  inputsCleared: false, worldwidePreview: false, writtenHostingPermission: false, evidenceDocument: "",
  validUntil: "", licenseUses: [],
});
const checkboxFields = [
  ["masterAuthority", "Authority over the master"],
  ["compositionAuthority", "Authority over the composition"],
  ["contributorsCleared", "Collaborators cleared"],
  ["inputsCleared", "Samples and inputs cleared"],
  ["worldwidePreview", "Worldwide preview permission"],
] as const;

const dateString = (value: string, time: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${time}Z` : value;

function DeclarationForm({ base, record, busy, run }: {
  base: { trackId: string; version: number }; record?: RightsRecord; busy: boolean; run: (action: RightsAction) => void;
}) {
  const [form, update] = useState<RightsDeclaration>(() => record ? { ...record.declaration,
    validUntil: record.declaration.validUntil.slice(0, 10), generatedAt: record.declaration.generatedAt?.slice(0, 10),
  } : blank());
  const set = <K extends keyof RightsDeclaration>(key: K, value: RightsDeclaration[K]) =>
    update((previous) => ({ ...previous, [key]: value }));
  return <View style={{ gap: 8 }}>
    <Note>Source provider</Note>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {RIGHTS_PROVIDERS.map((value) => <Action key={value} label={value} selected={form.provider === value} run={() => set("provider", value)} />)}
    </View>
    {form.provider !== "original" && <>
      <Note>Provider plan applicable to this output</Note>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {(["free", "paid", "custom", "unknown"] as const).map((value) => <Action key={value} label={value} selected={form.providerPlan === value} run={() => set("providerPlan", value)} />)}
      </View>
      <Field label="Generation date (YYYY-MM-DD)" value={form.generatedAt} onChangeText={(value) => set("generatedAt", value || undefined)} maxLength={10} />
      <Field label="Provider terms SHA-256" value={form.termsDigest} onChangeText={(value) => set("termsDigest", value || undefined)} maxLength={64} autoCapitalize="none" />
      <Field label="Official listing URL" value={form.providerListing} onChangeText={(value) => set("providerListing", value || undefined)} maxLength={512} autoCapitalize="none" />
      <Action label="Written platform hosting permission" selected={form.writtenHostingPermission} run={() => set("writtenHostingPermission", !form.writtenHostingPermission)} />
    </>}
    {checkboxFields.map(([key, label]) => <Action key={key} label={label} selected={form[key]} run={() => set(key, !form[key])} />)}
    <Field label="Permission expires (YYYY-MM-DD)" value={form.validUntil} onChangeText={(value) => set("validUntil", value)} maxLength={10} />
    <Field label="Private rights documentation" value={form.evidenceDocument} onChangeText={(value) => set("evidenceDocument", value)} multiline maxLength={16000} />
    {form.provider === "original" && <>
      <Note>Permitted uses for license inquiries</Note>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {LICENSE_USES.map((use) => <Action key={use} label={use} selected={form.licenseUses.includes(use)}
          run={() => set("licenseUses", form.licenseUses.includes(use) ? form.licenseUses.filter((item) => item !== use) : [...form.licenseUses, use])} />)}
      </View>
    </>}
    <Action label="Submit for rights review" disabled={busy} run={() => run({ action: "submit", ...base, declaration: {
      ...form, validUntil: dateString(form.validUntil, "23:59:59"),
      ...(form.generatedAt ? { generatedAt: dateString(form.generatedAt, "00:00:00") } : {}),
    } })} />
  </View>;
}

function InquiryForm({ track, busy, run }: { track: DiscoveryTrack; busy: boolean; run: (action: RightsAction) => void }) {
  const [use, setUse] = useState(track.rights.licenseUses[0]);
  const [territory, setTerritory] = useState("");
  const [term, setTerm] = useState("12");
  const [details, setDetails] = useState("");
  const [requestId, setRequestId] = useState("");
  const change = (setter: (value: string) => void) => (value: string) => { setRequestId(""); setter(value); };
  return <View style={{ gap: 8 }}>
    <Note>License inquiry. Usage requires a separate signed agreement.</Note>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{track.rights.licenseUses.map((value) =>
      <Action key={value} label={value} selected={value === use} run={() => { setUse(value); setRequestId(""); }} />
    )}</View>
    <Field label="Territory" value={territory} onChangeText={change(setTerritory)} maxLength={80} />
    <Field label="Term in months" value={term} onChangeText={change(setTerm)} keyboardType="number-pad" />
    <Field label="Project details" value={details} onChangeText={change(setDetails)} multiline maxLength={1000} />
    <Action label="Send license inquiry" disabled={busy} run={() => {
      const id = requestId || generateUUID();
      setRequestId(id);
      run({ action: "request", trackId: track.id, version: track.manifest.version, requestId: id, use: use!, territory, termMonths: Number(term), details });
    }} />
  </View>;
}

export function MusicRights({ track }: { track: DiscoveryTrack }) {
  const { account, token, busy: accountBusy, error, signIn } = useEncoreAccount();
  const owner = account?.user.id === track.artistId;
  const reviewer = !owner && Boolean(account?.user.roles.some((role) => role === "reviewer" || role === "admin"));
  const base = { trackId: track.id, version: track.manifest.version };
  const command = useRightsMutation();
  const query = useQuery({ queryKey: ["rights", track.id, account?.user.id], queryFn: () => rightsWorkspace(`?trackId=${track.id}`, token),
    enabled: Boolean(account && (owner || reviewer)), retry: false });
  const record = query.data?.records[0];
  const [reason, setReason] = useState("");
  return <View style={{ gap: 10 }}>
    <Text style={{ color: c.ink, fontSize: 20, fontWeight: "700" }}>Rights and licensing</Text>
    <Note>{track.rights.preview ? "Hosted preview permitted" : "Hosted preview unavailable"}</Note>
    {track.rights.externalUrl && <Action label="Open official provider listing" run={() => void Linking.openURL(track.rights.externalUrl!).catch(() => {})} />}
    {query.isError && <Note>{query.error.message}</Note>}
    {record && <Note>{record.status} · Rights file v{record.revision}{record.review_reason ? ` · ${record.review_reason}` : ""}</Note>}
    {owner && !query.isPending && (record?.status === "approved"
      ? <Action label="Withdraw permissions" disabled={command.busy} run={() => command.run({ action: "withdraw", ...base, revision: record.revision })} />
      : <DeclarationForm base={base} key={`${base.version}:${record?.revision}`} record={record} busy={command.busy} run={command.run} />)}
    {reviewer && record && <>
      <Note>{JSON.stringify(record.declaration, null, 2)}</Note>
      {record.status === "pending" && <>
        <Field label="Review reason" value={reason} onChangeText={setReason} multiline maxLength={500} />
        <Action label="Approve documented permissions" disabled={command.busy} run={() => command.run({ action: "review", ...base, revision: record.revision, decision: "approved", reason })} />
        <Action label="Reject documentation" disabled={command.busy} run={() => command.run({ action: "review", ...base, revision: record.revision, decision: "rejected", reason })} />
      </>}
    </>}
    {!owner && track.status === "published" && track.rights.licenseUses.length > 0 && (account
      ? <InquiryForm track={track} busy={command.busy} run={command.run} />
      : <Action label="Sign in to request licensing" disabled={accountBusy} run={() => void signIn()} />)}
    {command.message && <Note>{command.message}</Note>}
    {error && <Note>{error}</Note>}
  </View>;
}

function InquiryCard({ item }: { item: LicenseInquiry }) {
  const [note, setNote] = useState("");
  const command = useRightsMutation();
  return <View style={{ borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 }}>
    <Text style={{ color: c.ink, fontWeight: "700" }}>{item.title} · {item.direction}</Text>
    <Note>{item.scope.use} · {item.scope.territory} · {item.scope.termMonths} months</Note>
    <Note>{item.scope.details}</Note><Note>{formatLabel(item.status)}{item.response ? ` · ${item.response}` : ""}</Note>
    {item.direction === "received" && item.status === "pending" && <>
      <Field label="Response" value={note} onChangeText={setNote} maxLength={500} />
      <Action label="Accept for discussion" disabled={command.busy} run={() => command.run({ action: "respond", requestId: item.id, decision: "accepted_for_discussion", note })} />
      <Action label="Decline" disabled={command.busy} run={() => command.run({ action: "respond", requestId: item.id, decision: "declined", note })} />
    </>}
    {command.message && <Note>{command.message}</Note>}
  </View>;
}

export function RightsScreen() {
  const { account, token, busy, error, signIn, signOut } = useEncoreAccount();
  const reviewer = account?.user.roles.some((role) => role === "reviewer" || role === "admin");
  const query = useQuery({ queryKey: ["rights", "workspace", account?.user.id, reviewer], queryFn: () => rightsWorkspace(reviewer ? "?review=1" : "", token),
    enabled: Boolean(account), retry: false });
  const studio = useQuery({ queryKey: ["rights", "studio", account?.user.id], queryFn: () => listStudioTracks(token),
    enabled: Boolean(account?.user.roles.includes("artist")), retry: false });
  return <MusicPage><Heading>Rights workspace</Heading>
    {!account && <Action label="Sign in with Encore" disabled={busy} run={() => void signIn()} />}
    {error && <Note>{error}</Note>}
    {account && <>
      <Note>{account.user.displayName}</Note>
      <Action label="Sign out" disabled={busy} run={() => void signOut()} />
      {query.isPending && <Note>Loading rights files…</Note>}
      {query.isError && <><Note>{query.error.message}</Note><Action label="Retry workspace" run={() => void query.refetch()} /></>}
      {studio.data?.tracks.map((track) => <Link key={track.id} href={`/track/${track.id}`} style={{ color: c.berry }}>
        Manage rights for {track.title}
      </Link>)}
      {query.data?.records.map((record) => <Link key={record.track_id} href={`/track/${record.track_id}`} style={{ color: c.berry }}>
        Passport v{record.passport_version} · {record.status}
      </Link>)}
      {query.data?.records.length === 0 && <Note>No rights files to show.</Note>}
      <Text style={{ color: c.ink, fontWeight: "700" }}>License inquiries</Text>
      {query.data?.inquiries.map((item) => <InquiryCard key={item.id} item={item} />)}
      {query.data?.inquiries.length === 0 && <Note>No license inquiries yet.</Note>}
    </>}
  </MusicPage>;
}
