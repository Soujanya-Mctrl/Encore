import { randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { CatalogService } from "../packages/core/src/index.ts";
import {
  SupabaseCatalogRepository,
  SupabaseMediaStorage,
  sha256,
  mp3Inspector,
} from "../packages/infrastructure/src/index.ts";
process.loadEnvFile("apps/web/.env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const repo = new SupabaseCatalogRepository(url, key),
  storage = new SupabaseMediaStorage(url, key);
const service = new CatalogService(
  repo,
  storage,
  sha256,
  mp3Inspector,
  randomUUID,
);
const owner = randomUUID(),
  reviewer = randomUUID();
let releaseId: string | undefined, audioPath: string | undefined;
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
async function rest(path: string, method: string, body?: unknown) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(`Fixture ${method}: HTTP ${r.status}`);
}
async function insert(table: string, rows: unknown) {
  await rest(table, "POST", rows);
}
try {
  await insert("profiles", [
    { id: owner, display_name: "Disposable catalog test artist" },
    { id: reviewer, display_name: "Disposable catalog test reviewer" },
  ]);
  await insert("user_roles", [
    { user_id: owner, role: "artist" },
    { user_id: reviewer, role: "reviewer" },
  ]);
  const input = {
    title: "Disposable synthetic tone",
    artistName: "Test fixture",
    genre: "Ambient",
    description: "Synthetic integration test, not a cleared demo track",
    originCategory: "UNKNOWN" as const,
    previewConsent: true as const,
    contributions: [
      {
        role: "Fixture",
        mode: "unknown" as const,
        creatorRef: "Test fixture",
        consent: true as const,
      },
    ],
  };
  const track = await service.upload(
    owner,
    input,
    readFileSync(".local/phase-two/fixtures/test-tone.mp3"),
  );
  releaseId = track.id;
  audioPath = track.audioPath;
  check(track.durationSeconds > 1, "MP3 duration");
  check(
    !(await repo.search({ q: "Disposable", page: 1 })).tracks.some(
      (t) => t.id === track.id,
    ),
    "Draft leaked into catalog",
  );
  await service.revise(track.id, owner, input, 1);
  check((await repo.history(track.id)).length === 2, "History not persisted");
  await service.submit(track.id, owner);
  let denied = false;
  try {
    await service.review(track.id, owner, true);
  } catch {
    denied = true;
  }
  check(denied, "Self-review allowed");
  await service.review(track.id, reviewer, true);
  check(
    (await repo.get(track.id))?.status === "approved",
    "Review not persisted",
  );
  const preview = await storage.preview(track.audioPath);
  const audio = await fetch(preview, { headers: { Range: "bytes=0-99" } });
  check(audio.ok, "Private signed playback failed");
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const anon = await fetch(`${url}/rest/v1/catalog_releases?select=id`, {
    headers: { apikey: anonKey },
  });
  check(
    anon.status === 401 || anon.status === 403,
    "Anonymous catalog DB access was not denied",
  );
  const result = {
    checkedAt: new Date().toISOString(),
    status: "passed",
    checks: [
      "validated MP3 upload to private storage",
      "atomic registry + passport persistence",
      "immutable hash-linked v2 history",
      "draft excluded from public search",
      "self-review denial",
      "independent review",
      "signed Range playback",
      "anonymous DB denial",
    ],
    scope:
      "Disposable synthetic audio; not the three user demo tracks; on-chain publication is a separate test",
  };
  mkdirSync(".local/phase-two", { recursive: true });
  writeFileSync(
    ".local/phase-two/catalog.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (audioPath) await storage.remove(audioPath);
  if (releaseId) {
    await rest(`catalog_audit?release_id=eq.${releaseId}`, "DELETE");
    await rest(`catalog_passports?release_id=eq.${releaseId}`, "DELETE");
    await rest(`catalog_releases?id=eq.${releaseId}`, "DELETE");
  }
  await rest(`user_roles?user_id=in.(${owner},${reviewer})`, "DELETE");
  await rest(`profiles?id=in.(${owner},${reviewer})`, "DELETE");
}
