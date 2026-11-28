import { randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { HmacSessionTokenService } from "../packages/infrastructure/src/index.ts";
process.loadEnvFile("apps/web/.env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  app = "http://localhost:3000";
const artist = Keypair.generate(),
  payer = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(".local/phase-one/devnet-payer.json", "utf8")),
    ),
  );
const owner = randomUUID(),
  reviewer = randomUUID();
let releaseId: string | undefined, path: string | undefined;
const sessions = new HmacSessionTokenService(
  process.env.ENCORE_SESSION_SECRET!,
);
async function rest(path: string, method: string, body?: unknown) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(`Fixture ${method}: HTTP ${r.status}`);
}
async function api(path: string, token: string, body?: unknown) {
  const r = await fetch(app + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie: `encore_session=${token}`,
      origin: app,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`API ${path} HTTP ${r.status}: ${data.error}`);
  return data;
}
const check = (b: unknown, m: string) => {
  if (!b) throw new Error(m);
};
try {
  await rest("profiles", "POST", [
    {
      id: owner,
      display_name: "Disposable registry artist",
      onboarding_status: "completed",
    },
    {
      id: reviewer,
      display_name: "Disposable registry reviewer",
      onboarding_status: "completed",
    },
  ]);
  await rest("user_roles", "POST", [
    { user_id: owner, role: "artist" },
    { user_id: reviewer, role: "reviewer" },
  ]);
  await rest("wallets", "POST", {
    user_id: owner,
    address: artist.publicKey.toBase58(),
    chain: "solana",
    wallet_type: "external",
    verified_at: new Date().toISOString(),
  });
  const ownerToken = await sessions.issueSessionToken({
      userId: owner,
      roles: ["artist"],
      sessionId: randomUUID(),
    }),
    reviewToken = await sessions.issueSessionToken({
      userId: reviewer,
      roles: ["reviewer"],
      sessionId: randomUUID(),
    });
  const audio = readFileSync(".local/phase-two/fixtures/test-tone.mp3");
  const grant = await api("/api/v1/uploads/init", ownerToken, {
    size: audio.length,
  });
  const uploaded = await fetch(grant.url, {
    method: "PUT",
    headers: { "content-type": "audio/mpeg" },
    body: audio,
  });
  check(uploaded.ok, "Signed direct upload failed");
  const metadata = {
    title: "Registry smoke synthetic " + randomUUID().slice(0, 8),
    artistName: "Disposable fixture",
    genre: "Test",
    description: "Synthetic integration fixture; removed after test",
    originCategory: "UNKNOWN",
    previewConsent: true,
    contributions: [
      { role: "Fixture", mode: "unknown", creatorRef: "Test", consent: true },
    ],
  };
  const finalized = await api("/api/v1/uploads/finalize", ownerToken, {
    grant: grant.grant,
    metadata,
  });
  releaseId = finalized.track.id;
  path = finalized.track.audioPath;
  const replay = await api("/api/v1/uploads/finalize", ownerToken, {
    grant: grant.grant,
    metadata,
  });
  check(replay.track.id === releaseId, "Finalize not idempotent");
  check(
    (await fetch(app + `/api/v1/tracks/${releaseId}`)).status === 404,
    "Draft publicly visible",
  );
  await api(`/api/v1/tracks/${releaseId}/submit`, ownerToken, {});
  await api(`/api/v1/tracks/${releaseId}/review`, reviewToken, {
    approve: true,
  });
  const c = new Connection("https://api.devnet.solana.com", "confirmed");
  await sendAndConfirmTransaction(
    c,
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: artist.publicKey,
        lamports: 15000000,
      }),
    ),
    [payer],
  );
  const prepared = await api(`/api/v1/tracks/${releaseId}/anchor`, ownerToken, {
    address: artist.publicKey.toBase58(),
  });
  let signature = "";
  for (const encoded of prepared.transactions) {
    const tx = Transaction.from(Buffer.from(encoded, "base64"));
    tx.partialSign(artist);
    const sent = await api(`/api/v1/tracks/${releaseId}/anchor`, ownerToken, {
      address: artist.publicKey.toBase58(),
      signedTransaction: tx.serialize().toString("base64"),
    });
    signature = sent.signature;
  }
  let published = false;
  for (let i = 0; i < 35; i++) {
    try {
      await api(`/api/v1/tracks/${releaseId}/anchor`, ownerToken, {
        address: artist.publicKey.toBase58(),
        signature,
      });
      published = true;
      break;
    } catch (e) {
      if (i === 34) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  check(published, "Not published");
  const found = await api(
    "/api/v1/tracks?q=" + encodeURIComponent(metadata.title),
    "",
  );
  check(
    found.tracks.some((t: { id: string }) => t.id === releaseId),
    "Search did not find finalized track",
  );
  const play = await fetch(app + `/api/v1/tracks/${releaseId}/play`, {
    redirect: "manual",
  });
  check(play.status === 307, "Public playback not enabled");
  const bytes = await fetch(play.headers.get("location")!, {
    headers: { Range: "bytes=0-99" },
  });
  check(bytes.status === 206, "Range playback failed");
  const result = {
    checkedAt: new Date().toISOString(),
    status: "passed",
    programId: prepared.programId,
    passport: prepared.passport,
    signature,
    checks: [
      "direct one-object upload grant",
      "validated finalize",
      "idempotent finalize",
      "draft visibility denial",
      "independent review",
      "wallet-signed devnet registration",
      "finalized on-chain hash reconciliation",
      "public search",
      "private signed Range playback",
    ],
    scope: "Disposable synthetic UNKNOWN fixture; not a user demo track",
  };
  mkdirSync(".local/phase-two", { recursive: true });
  writeFileSync(
    ".local/phase-two/registry.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (path) {
    const response = await fetch(url + "/storage/v1/object/encore-previews", {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prefixes: [path] }),
    });
    if (!response.ok) console.log("Test media cleanup pending");
  }
  if (releaseId) {
    await rest(`catalog_audit?release_id=eq.${releaseId}`, "DELETE");
    await rest(`catalog_passports?release_id=eq.${releaseId}`, "DELETE");
    await rest(`catalog_releases?id=eq.${releaseId}`, "DELETE");
  }
  await rest(`wallets?user_id=eq.${owner}`, "DELETE");
  await rest(`user_roles?user_id=in.(${owner},${reviewer})`, "DELETE");
  await rest(`profiles?id=in.(${owner},${reviewer})`, "DELETE");
}
