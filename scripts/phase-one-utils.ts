import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

export const evidenceDirectory = ".local/phase-one";
export function loadLocalEnvironment() {
  process.loadEnvFile("apps/web/.env.local");
  mkdirSync(evidenceDirectory, { recursive: true });
}
export function saveEvidence(name: string, evidence: unknown) {
  writeFileSync(`${evidenceDirectory}/${name}.json`, JSON.stringify(evidence, null, 2), { mode: 0o600 });
}
export function devnetPayer() {
  const file = `${evidenceDirectory}/devnet-payer.json`;
  if (existsSync(file)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, "utf8"))));
  const payer = Keypair.generate();
  writeFileSync(file, JSON.stringify(Array.from(payer.secretKey)), { mode: 0o600, flag: "wx" });
  return payer;
}
export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}; configure apps/web/.env.local`);
  return value;
}
