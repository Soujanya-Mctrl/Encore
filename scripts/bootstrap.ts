import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envFile = "apps/web/.env.local";
if (process.argv.includes("--init") && !existsSync(envFile)) {
  const template = readFileSync(".env.example", "utf8");
  writeFileSync(envFile, template.replace("ENCORE_SESSION_SECRET=", `ENCORE_SESSION_SECRET=${randomBytes(48).toString("base64url")}`), { mode: 0o600, flag: "wx" });
  console.log(`Created ${envFile} with a random session secret. Existing files are never overwritten.`);
}
if (existsSync(envFile)) process.loadEnvFile(envFile);
const supportedNode = [22, 24].includes(Number(process.versions.node.split(".")[0]));
console.log(`${supportedNode ? "PASS" : "FAIL"} Node ${process.versions.node}; use the version in .nvmrc.`);
const pm = spawnSync("pnpm", ["--version"], { encoding: "utf8", timeout: 15_000 });
const pnpmVersion = pm.stdout?.trim();
console.log(`${pm.status === 0 && pnpmVersion === "9.15.0" ? "PASS" : "FAIL"} pnpm ${pnpmVersion || "unavailable"}; required 9.15.0.`);
const localReady = supportedNode && pm.status === 0 && pnpmVersion === "9.15.0" &&
  Buffer.byteLength(process.env.ENCORE_SESSION_SECRET ?? "") >= 32 &&
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet";
console.log(`${localReady ? "PASS" : "FAIL"} Local environment (secret is never printed).`);
for (const [label, keys] of [
  ["Pollar", ["NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY"]],
  ["ElevenLabs", ["ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID"]],
  ["Firecrawl", ["FIRECRAWL_API_KEY"]]
] as const) {
  console.log(`${keys.every((key) => !!process.env[key]?.trim()) ? "CONFIGURED" : "PENDING"} ${label}; live verification is a separate checkpoint.`);
}
console.log(`${process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) ? "CONFIGURED" : "PENDING"} Supabase; migrations and live verification are separate checkpoints.`);
for (const command of ["cargo", "anchor", "solana", "supabase"]) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 10_000 });
  console.log(`${result.status === 0 ? "AVAILABLE" : "PENDING"} ${command}`);
}
console.log("See docs/planning/PHASE_ONE_REPORT.md for evidence required to finish Phase 1.");
if (!localReady) process.exitCode = 1;
