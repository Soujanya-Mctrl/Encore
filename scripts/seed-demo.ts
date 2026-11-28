import { randomUUID } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";
import { Keypair, Transaction } from "@solana/web3.js";
import { ReleaseInputSchema, RightsDeclarationSchema } from "../packages/contracts/src/index.ts";
import { CatalogService, effectiveRights } from "../packages/core/src/index.ts";
import {
  SupabaseCatalogRepository,
  SupabaseMediaStorage,
  SupabaseRightsRepository,
  SolanaRegistry,
  sha256,
  mp3Inspector,
} from "../packages/infrastructure/src/index.ts";
process.loadEnvFile("apps/web/.env.local");
const categories = [
  ["human-created", "HUMAN_CREATED", "human"],
  ["ai-assisted", "AI_ASSISTED", "assisted"],
  ["ai-generated", "AI_GENERATED", "generative_ai"],
] as const;
// Validate all three files before creating any account, media object or chain transaction.
const fixtures = categories.map(([folder, originCategory, mode]) => {
  const dir = path.join(".local/demo-tracks", folder),
    files = readdirSync(dir).filter(
      (f) => !f.startsWith("._") && /\.mp3$/i.test(f),
    );
  if (files.length !== 1 || !existsSync(path.join(dir, "metadata.json")) || !existsSync(path.join(dir, "rights.json")))
    throw new Error(
      `Place one MP3, metadata.json, and private rights.json in ${dir}; see the Phase 5–6 handoff`,
    );
  const raw = JSON.parse(readFileSync(path.join(dir, "metadata.json"), "utf8")),
    bytes = readFileSync(path.join(dir, files[0]!));
  mp3Inspector.inspect(bytes);
  const input = ReleaseInputSchema.parse({
    ...raw,
    description:
      (raw.description ?? "") +
      " Demo release; origin is creator-declared, not independently corroborated.",
    originCategory,
    previewConsent: true,
    contributions: [
      { role: "Creator", mode, creatorRef: raw.artistName, consent: true },
    ],
  });
  const declaration = RightsDeclarationSchema.parse(JSON.parse(readFileSync(path.join(dir, "rights.json"), "utf8")));
  if (Date.parse(declaration.validUntil) <= Date.now()) throw new Error(`Rights documentation expired in ${dir}`);
  return { folder, bytes, input, declaration };
});
const statePath = ".local/phase-two/demo-state.json";
mkdirSync(".local/phase-two", { recursive: true });
const state: {
  owner: string;
  reviewer: string;
  tracks: Record<string, { id: string; signature?: string }>;
} = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { owner: randomUUID(), reviewer: randomUUID(), tracks: {} };
function save() {
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", {
    mode: 0o600,
  });
}
save();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function rest(resource: string, method = "GET", body?: unknown) {
  const r = await fetch(url + "/rest/v1/" + resource, {
    method,
    headers: {
      apikey: key,
      "content-type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(`Demo fixture operation failed: HTTP ${r.status}`);
  return r.status === 204 || r.headers.get("content-length") === "0"
    ? null
    : await r.json().catch(() => null);
}
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(readFileSync(".local/phase-one/devnet-payer.json", "utf8")),
  ),
);
await rest("profiles", "POST", [
  {
    id: state.owner,
    display_name: "Encore demo artist operator",
    onboarding_status: "completed",
  },
  {
    id: state.reviewer,
    display_name: "Encore demo curator (project-owner clearance)",
    onboarding_status: "completed",
  },
]);
await rest("user_roles", "POST", [
  { user_id: state.owner, role: "artist" },
  { user_id: state.reviewer, role: "reviewer" },
]);
const binding = await rest(
  "wallets?address=eq." + payer.publicKey.toBase58() + "&select=user_id",
);
if (binding?.some((b: { user_id: string }) => b.user_id !== state.owner))
  throw new Error(
    "The demo signing wallet already belongs to a different profile; no binding was changed",
  );
await rest("wallets", "POST", {
  user_id: state.owner,
  address: payer.publicKey.toBase58(),
  chain: "solana",
  wallet_type: "external",
  verified_at: new Date().toISOString(),
});
const repo = new SupabaseCatalogRepository(url, key),
  rights = new SupabaseRightsRepository(url, key),
  storage = new SupabaseMediaStorage(url, key),
  service = new CatalogService(repo, storage, sha256, mp3Inspector, randomUUID),
  registry = new SolanaRegistry(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  );
let reviewPending = false;
for (const f of fixtures) {
  const entry = state.tracks[f.folder] ?? { id: randomUUID() };
  state.tracks[f.folder] = entry;
  save();
  let r = await repo.get(entry.id);
  if (!r) r = await service.upload(state.owner, f.input, f.bytes, entry.id);
  if (r.artistId !== state.owner || r.audioHash !== sha256.bytes(f.bytes))
    throw new Error(
      "An existing immutable demo differs from the supplied audio; create a new release instead",
    );
  const declaration = {
    ...f.declaration, evidenceDigest: sha256.bytes(Buffer.from(f.declaration.evidenceDocument)),
  };
  const record = (await rights.records([r])).get(r.id);
  if (!record || record.status !== "approved" || sha256.hash(declaration) !== sha256.hash(record.declaration)) {
    if (record?.status !== "approved") {
      await rights.apply(state.owner, { action: "submit", trackId: r.id, version: r.manifest.version, declaration });
    }
    reviewPending = true;
    console.log(`Rights review required for ${f.folder}: ${r.id}`);
    continue;
  }
  if (r.status === "published") continue;
  if (r.status === "draft") {
    await service.submit(r.id, state.owner);
    r = (await repo.get(r.id))!;
  }
  if (r.status === "submitted") {
    await service.review(r.id, state.reviewer, true);
    r = (await repo.get(r.id))!;
  }
  if (r.status !== "approved" && r.status !== "anchor_pending")
    throw new Error("Demo release needs manual review");
  const prepared = await registry.prepare(
    r,
    payer.publicKey.toBase58(),
    await repo.history(r.id),
  );
  let signature = prepared.existingSignature ?? entry.signature;
  for (const encoded of prepared.transactions) {
    const tx = Transaction.from(Buffer.from(encoded, "base64"));
    tx.partialSign(payer);
    signature = await registry.send(
      tx.serialize().toString("base64"),
      r,
      payer.publicKey.toBase58(),
      await repo.history(r.id),
    );
    entry.signature = signature;
    save();
  }
  if (!signature) throw new Error("Registry receipt missing");
  for (let i = 0; i < 40; i++) {
    try {
      await registry.verify(r, payer.publicKey.toBase58(), signature);
      break;
    } catch (e) {
      if (i === 39) throw e;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  await repo.publish(r.id, r.manifestHash, signature, state.owner);
  console.log(`Published ${f.folder}: ${r.id}`);
}
if (reviewPending) {
  console.log("Complete an independent rights review in the workspace, then rerun the seed command.");
  process.exit(0);
}
for(const [folder,origin] of categories){
  const record=state.tracks[folder]!;
  const track=await repo.get(record.id);
  if(!track)throw new Error(`Missing published ${folder} track`);
  const results=await repo.search({q:track.title,origin,page:1});
  if(!results.tracks.some(t=>t.id===record.id))throw new Error(`${folder} demo did not appear in the catalog`);
  const clearance = effectiveRights((await rights.records([track])).get(track.id), new Date());
  console.log(`${folder}: ${clearance.preview ? "hosted preview" : clearance.externalUrl ? "provider listing" : "metadata only"}`);
}
console.log(
  "All three demo tracks are searchable with their current Passport and reviewed rights.",
);
