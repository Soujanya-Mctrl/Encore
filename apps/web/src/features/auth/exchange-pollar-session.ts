import { buildProof, type KeyManager, type PollarClient } from "@pollar/core";
import { POLLAR_PROFILE_URL, POLLAR_WALLET_URL } from "@encore/contracts";
import type { EncoreUser, WalletRecord } from "@encore/core";

export async function exchangePollarSession(client: PollarClient, keys: KeyManager) {
  const nonces: Partial<Record<"profile" | "wallet", string>> = {};
  for (let attempt = 0; attempt < 6; attempt++) {
    const state = client.getAuthState();
    if (state.step !== "authenticated" || !state.verified) throw new Error("Sign in with Pollar first");
    const accessToken = state.session.token.accessToken;
    const [profileProof, walletProof] = await Promise.all([
      buildProof({ htm: "GET", htu: POLLAR_PROFILE_URL, accessToken, nonce: nonces.profile }, keys),
      buildProof({ htm: "GET", htu: POLLAR_WALLET_URL, accessToken, nonce: nonces.wallet }, keys)
    ]);
    const response = await fetch("/api/v1/auth/pollar/session", {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken, profileProof, walletProof })
    });
    if (response.ok) return await response.json() as { user: EncoreUser; wallets: WalletRecord[] };
    const body = await response.json().catch(() => ({})) as {
      error?: string; challenge?: { endpoint: string; nonce: string }
    };
    if ((response.status === 503 || response.status === 429) && attempt < 5) {
      // A consumed DPoP proof cannot be replayed after a timeout. Start the next
      // exchange with fresh device signatures instead of retrying the old body.
      await new Promise((resolve) => setTimeout(resolve, Math.min(200 * 2 ** attempt, 2000)));
      continue;
    }
    if (response.status === 401 && body.challenge &&
      ["profile", "wallet"].includes(body.challenge.endpoint) &&
      typeof body.challenge.nonce === "string" && body.challenge.nonce.length <= 2048) {
      nonces[body.challenge.endpoint as "profile" | "wallet"] = body.challenge.nonce;
      continue;
    }
    throw new Error(body.error ?? "Could not establish your Encore session");
  }
  throw new Error("Pollar verification needs a fresh login. Please sign out and try again.");
}
