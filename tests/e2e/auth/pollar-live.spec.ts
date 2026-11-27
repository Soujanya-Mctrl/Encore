import { expect, test } from "@playwright/test";
import { Keypair } from "@solana/web3.js";

const live = process.env.ENCORE_RUN_LIVE_TESTS === "1";
if (live) process.loadEnvFile("apps/web/.env.local");

test("Pollar external-wallet login creates a persistent Encore session", async ({ page, context }) => {
  test.skip(!live, "Explicit opt-in required: exercises real Pollar and Supabase services");
  test.setTimeout(120_000);
  const payer = Keypair.generate();
  const address = payer.publicKey.toBase58();
  await page.addInitScript(({ address, publicKey, seed }) => {
    const account = Object.freeze({ address, publicKey: new Uint8Array(publicKey), chains: ["solana:devnet"],
      features: ["solana:signMessage", "solana:signIn"] });
    const signingKey = crypto.subtle.importKey("pkcs8", new Uint8Array([
      48,46,2,1,0,48,5,6,3,43,101,112,4,34,4,32, ...seed
    ]), { name: "Ed25519" }, false, ["sign"]);
    const signMessage = async (message: Uint8Array) => new Uint8Array(await crypto.subtle.sign("Ed25519", await signingKey, new Uint8Array(message)));
    const wallet = Object.freeze({ version: "1.0.0", name: "Encore Phase One Wallet",
      icon: "data:image/svg+xml;base64,PHN2Zy8+", chains: ["solana:devnet"], accounts: [account], features: {
        "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [account] }) },
        "standard:disconnect": { version: "1.0.0", disconnect: async () => {} },
        "standard:events": { version: "1.0.0", on: () => () => {} },
        "solana:signMessage": { version: "1.0.0", signMessage: async (...inputs: { message: Uint8Array }[]) =>
          Promise.all(inputs.map(async ({ message }) => ({ signedMessage: message, signature: await signMessage(message) }))) },
        "solana:signIn": { version: "1.0.0", signIn: async (...inputs: Record<string, string>[]) => Promise.all(inputs.map(async (input) => {
          let message = `${input.domain ?? ""} wants you to sign in with your Solana account:\n${address}`;
          if (input.statement) message += `\n\n${input.statement}`;
          const fields = [["uri", "URI"], ["version", "Version"], ["chainId", "Chain ID"], ["nonce", "Nonce"], ["issuedAt", "Issued At"], ["expirationTime", "Expiration Time"]]
            .filter(([key]) => input[key!]).map(([key, label]) => `${label}: ${input[key!]}`);
          if (fields.length) message += `\n\n${fields.join("\n")}`;
          const signedMessage = new TextEncoder().encode(message);
          return { account, signedMessage, signature: await signMessage(signedMessage) };
        })) }
      } });
    const register = (api: { register: (...wallets: unknown[]) => void }) => api.register(wallet);
    window.addEventListener("wallet-standard:app-ready", ((event: CustomEvent) => register(event.detail)) as EventListener);
    window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
  }, { address, publicKey: Array.from(payer.publicKey.toBytes()), seed: Array.from(payer.secretKey.slice(0, 32)) });
  try {
    await page.goto("/login");
    const button = page.getByRole("button", { name: /Encore Phase One Wallet/ });
    await expect(button).toBeVisible({ timeout: 30_000 });
    await button.click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 60_000 });
    const cookie = (await context.cookies()).find((c) => c.name === "encore_session");
    expect(cookie?.httpOnly).toBe(true);
    const response = await page.request.get("/api/v1/auth/me");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.wallets.some((w: { address: string }) => w.address === address)).toBe(true);
    const escalation = await page.request.post("/api/v1/auth/onboarding", {
      headers: { origin: "http://localhost:3000" },
      data: { displayName: "Must not become admin", journey: "admin" }
    });
    expect(escalation.status()).toBe(400);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Set up your Encore profile" })).toBeVisible({ timeout: 30_000 });
  } finally {
    // This random wallet is created only for this test. Remove its test profile,
    // never existing application users or the separately funded devnet payer.
    const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url && apiKey) {
      const result = await fetch(new URL(`/rest/v1/auth_identities?provider=eq.solana_siws&provider_subject=eq.${address}&select=user_id`, url), { headers: { apikey: apiKey } });
      if (result.ok) for (const row of await result.json()) {
        await fetch(new URL(`/rest/v1/profiles?id=eq.${row.user_id}`, url), { method: "DELETE", headers: { apikey: apiKey } });
      }
    }
  }
});
