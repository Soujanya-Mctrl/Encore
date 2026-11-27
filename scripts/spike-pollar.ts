import { createPrivateKey, sign } from "node:crypto";
import { buildProof, type KeyManager, type PublicEcJwk } from "@pollar/core";
import { POLLAR_PROFILE_URL, POLLAR_WALLET_URL } from "../packages/contracts/src/index.ts";
import { PollarSessionVerifier } from "../packages/infrastructure/src/authentication/pollar-session-verifier.ts";
import { devnetPayer, loadLocalEnvironment, required, saveEvidence } from "./phase-one-utils.ts";

loadLocalEnvironment();
const apiKey = required("NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY");
const origin = new URL(required("NEXT_PUBLIC_APP_URL")).origin;
const payer = devnetPayer();
const base = "https://sdk.api.pollar.xyz/v3";
const key = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
const publicJwk = await crypto.subtle.exportKey("jwk", key.publicKey) as PublicEcJwk;
const keys: KeyManager = {
  init: async () => {}, reset: async () => {}, getPublicJwk: async () => publicJwk,
  getThumbprint: async () => { throw new Error("Not needed by this isolated spike"); },
  sign: async (payload) => new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, new Uint8Array(payload)))
};
async function post(path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: {
    "x-pollar-api-key": apiKey, Origin: origin, "content-type": "application/json"
  }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45_000) });
  const data = await response.json();
  if (!response.ok || data.success !== true) throw new Error(`Pollar ${path}: HTTP ${response.status}, code ${typeof data.code === "string" && /^[A-Z_]+$/.test(data.code) ? data.code : "unavailable"}`);
  return data.content;
}

try {
  const session = await post("/auth/session");
  const { input } = await post("/auth/wallet/solana/challenge", { clientSessionId: session.clientSessionId, walletAddress: payer.publicKey.toBase58() });
  if (input.address !== payer.publicKey.toBase58()) throw new Error("Pollar challenge address mismatch");
  let message = `${input.domain ?? ""} wants you to sign in with your Solana account:\n${input.address}`;
  if (input.statement) message += `\n\n${input.statement}`;
  const fields: string[] = [];
  for (const [field, label] of [["uri", "URI"], ["version", "Version"], ["chainId", "Chain ID"], ["nonce", "Nonce"], ["issuedAt", "Issued At"], ["expirationTime", "Expiration Time"], ["notBefore", "Not Before"], ["requestId", "Request ID"]]) {
    if (input[field!]) fields.push(`${label}: ${input[field!]}`);
  }
  if (input.resources?.length) fields.push(["Resources:", ...input.resources.map((r: string) => `- ${r}`)].join("\n"));
  if (fields.length) message += `\n\n${fields.join("\n")}`;
  const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(payer.secretKey.slice(0, 32))]), type: "pkcs8", format: "der" });
  const signature = sign(null, Buffer.from(message), privateKey);
  await post("/auth/wallet/solana", { clientSessionId: session.clientSessionId, walletAddress: payer.publicKey.toBase58(), signedMessage: Buffer.from(message).toString("base64url"), signature: signature.toString("base64url") });
  const login = await post("/auth/login", { clientSessionId: session.clientSessionId, dpopJwk: publicJwk, deviceLabel: "Encore Phase 1 devnet smoke test" });
  const accessToken = login.token.accessToken;
  const nonces: Record<string, string> = {};
  let identity;
  const verifier = new PollarSessionVerifier(apiKey, async (target, options) => {
    const response = await fetch(target, options);
    const data = await response.clone().json().catch(() => ({}));
    console.log(JSON.stringify({ endpoint: new URL(String(target)).pathname, httpStatus: response.status,
      code: typeof data.code === "string" && /^[A-Z_]+$/.test(data.code) ? data.code : null,
      profileFieldTypes: data.content?.providers ? Object.fromEntries(["mail", "first_name", "last_name", "avatar"].map((k) => [k, data.content[k] === null ? "null" : typeof data.content[k]])) : undefined,
      providerKinds: data.content?.providers ? Object.entries(data.content.providers).filter(([, v]) => v !== null).map(([k]) => k) : undefined,
      walletNetworks: Array.isArray(data.content?.wallets) ? data.content.wallets.map((w: { chain?: string; network?: string; type?: string; provisioning?: string }) => ({ chain: w.chain, network: w.network, type: w.type, provisioning: w.provisioning })) : undefined
    }));
    return response;
  }, origin);
  for (let attempt = 0; attempt < 4; attempt++) {
    const profileProof = await buildProof({ htm: "GET", htu: POLLAR_PROFILE_URL, accessToken, nonce: nonces.profile }, keys);
    const walletProof = await buildProof({ htm: "GET", htu: POLLAR_WALLET_URL, accessToken, nonce: nonces.wallet }, keys);
    try { identity = await verifier.verify({ accessToken, profileProof, walletProof }); break; }
    catch (error) {
      const challenge = error as { nonce?: string; endpoint?: string };
      if (!challenge.nonce || !challenge.endpoint) throw error;
      nonces[challenge.endpoint] = challenge.nonce;
    }
  }
  if (!identity?.walletAddress) throw new Error("Pollar login succeeded but returned no verified Solana devnet wallet");
  const result = { checkedAt: new Date().toISOString(), status: "passed", walletAddress: identity.walletAddress,
    walletType: identity.walletType, method: "Real Pollar SIWS and DPoP verification using a generated test wallet", socialLogin: "not exercised", embeddedWalletProvisioning: "not exercised" };
  saveEvidence("pollar-signing", result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { checkedAt: new Date().toISOString(), status: "failed", reason: error instanceof Error ? error.message : "Pollar smoke test failed" };
  saveEvidence("pollar-signing", result); console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
}
