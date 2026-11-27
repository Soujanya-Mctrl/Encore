import { randomUUID } from "node:crypto";
import { SupabaseIdentityRepository } from "../packages/infrastructure/src/persistence/repositories/supabase-identity.repository.ts";
import { loadLocalEnvironment, required, saveEvidence } from "./phase-one-utils.ts";

loadLocalEnvironment();
const checks: Record<string, unknown> = {};
const secret = process.env.SUPABASE_SECRET_KEY || required("SUPABASE_SERVICE_ROLE_KEY");
const url = required("NEXT_PUBLIC_SUPABASE_URL");
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const createdIds: string[] = [];
async function rest(path: string, apiKey = secret, init: RequestInit = {}) {
  return fetch(new URL(`/rest/v1/${path}`, url), { ...init, headers: {
    apikey: apiKey, "content-type": "application/json", ...init.headers
  }, signal: AbortSignal.timeout(20_000) });
}

try {
  const configResponse = await fetch("https://sdk.api.pollar.xyz/v3/applications/config", {
    headers: { "x-pollar-api-key": required("NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY"), Origin: required("NEXT_PUBLIC_APP_URL") },
    signal: AbortSignal.timeout(20_000)
  });
  const config = await configResponse.json();
  if (!configResponse.ok || config.success !== true || config.content?.application?.network !== "testnet" ||
    !config.content?.application?.chains?.includes("SOLANA")) throw new Error("Pollar app must enable SOLANA in its test environment");
  checks.pollarConfiguration = { passed: true, network: "testnet", chains: ["SOLANA"],
    allowedOrigin: configResponse.headers.get("access-control-allow-origin") };

  for (const table of ["profiles", "auth_identities", "wallets", "user_roles", "user_preferences", "auth_challenges"]) {
    const response = await rest(`${table}?select=*&limit=0`);
    if (!response.ok) throw new Error(`Supabase ${table} schema check: HTTP ${response.status}`);
  }
  const repository = new SupabaseIdentityRepository(url, secret);
  const fixture = await repository.createUserWithIdentity({ displayName: "Encore Phase 1 Test", provider: "email", providerSubject: `phase-one-${randomUUID()}@example.com` });
  createdIds.push(fixture.user.id);
  await repository.updateOnboardingProfile(fixture.user.id, {
    displayName: "Encore Phase 1 Test", journey: "artist", preferredGenres: ["Ambient"],
    creativeOriginPreferences: { humanCreated: true, aiAssisted: true, aiGenerated: true, exploreAll: true }
  });
  const independentRepository = new SupabaseIdentityRepository(url, secret);
  const persisted = await independentRepository.findUserById(fixture.user.id);
  if (!persisted?.roles.includes("artist") || persisted.onboardingStatus !== "completed") throw new Error("Supabase persistence check failed");
  checks.supabasePersistence = { passed: true, tables: 6, independentClientRead: true };

  const read = await rest(`profiles?id=eq.${fixture.user.id}&select=id`, anon);
  const visible = read.ok ? await read.json() : [];
  if (read.ok && (!Array.isArray(visible) || visible.length !== 0)) throw new Error("Anonymous caller can read private profile");
  const write = await rest("profiles", anon, { method: "POST", body: JSON.stringify({ display_name: "Must be rejected" }) });
  if (![401, 403].includes(write.status)) throw new Error(`Anonymous insert was not denied: HTTP ${write.status}`);
  checks.supabaseIsolation = { passed: true, anonymousReadStatus: read.status, hiddenRows: true, anonymousInsertStatus: write.status };

  const sourceUrl = "https://github.com/VanshDeo/Encore";
  const crawl = await fetch("https://api.firecrawl.dev/v2/scrape", { method: "POST", headers: {
    Authorization: `Bearer ${required("FIRECRAWL_API_KEY")}`, "content-type": "application/json"
  }, body: JSON.stringify({ url: sourceUrl, formats: ["markdown"], onlyMainContent: true }), signal: AbortSignal.timeout(60_000) });
  const extracted = await crawl.json();
  if (!crawl.ok || extracted.success !== true || !extracted.data?.markdown?.length) throw new Error(`Firecrawl extraction failed: HTTP ${crawl.status}`);
  checks.firecrawl = { passed: true, sourceUrl, markdownCharacters: extracted.data.markdown.length,
    scope: "Authorized public project page: API feasibility only; not a commissioning lead" };
  checks.elevenLabs = { status: "deferred", reason: "User explicitly deferred credentials and live session" };
  const result = { checkedAt: new Date().toISOString(), status: "passed", checks };
  saveEvidence("services", result); console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { checkedAt: new Date().toISOString(), status: "failed", checks,
    reason: error instanceof Error ? error.message : "Service smoke test failed" };
  saveEvidence("services", result); console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
} finally {
  // Delete only the synthetic profiles created by this invocation; never existing users.
  for (const id of createdIds) {
    const result = await rest(`profiles?id=eq.${id}`, secret, { method: "DELETE" });
    if (!result.ok) { console.error("Synthetic smoke-test profile cleanup failed"); process.exitCode = 1; }
  }
}
