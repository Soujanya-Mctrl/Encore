import { z } from "zod";
import { POLLAR_CONFIG_URL, POLLAR_PROFILE_URL, POLLAR_WALLET_URL, SolanaAddressSchema } from "@encore/contracts";
import type { ExternalIdentityVerifierPort, VerifiedExternalIdentity } from "@encore/core";

const ProfileSchema = z.object({
  success: z.literal(true),
  content: z.object({
    mail: z.string(), first_name: z.string(), last_name: z.string(), avatar: z.string(),
    providers: z.object({
      google: z.object({ id: z.string().min(1) }).nullable(),
      github: z.object({ id: z.string().min(1) }).nullable(),
      email: z.object({ address: z.string().email() }).nullable(),
      wallet: z.object({ address: z.string().min(1) }).nullable()
    })
  })
});
const WalletStateSchema = z.object({
  success: z.literal(true),
  content: z.object({ wallets: z.array(z.object({
    address: z.string().nullable(), chain: z.string().optional(),
    type: z.enum(["internal", "external", "smart"]),
    network: z.string().optional(), provisioning: z.string().optional()
  })) })
});

export class PollarVerificationError extends Error {
  constructor(
    readonly status: 401 | 503,
    readonly endpoint?: "profile" | "wallet",
    readonly nonce?: string
  ) {
    super(status === 401 ? "Pollar session could not be verified" : "Pollar verification is unavailable");
  }
}

/** Pollar validates the token, DPoP signature/binding, replay and revocation.
 * Only the authenticated upstream responses supply identity and wallet data. */
export class PollarSessionVerifier implements ExternalIdentityVerifierPort {
  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch,
    private readonly appOrigin = "http://localhost:3000") {}

  private async read(url: string, token: string, proof: string, endpoint: "profile" | "wallet") {
    let response: Response;
    try {
      const options = {
        headers: { "x-pollar-api-key": this.apiKey, Origin: this.appOrigin, Authorization: `DPoP ${token}`, DPoP: proof },
        cache: "no-store" as const, redirect: "error" as const, signal: AbortSignal.timeout(10_000)
      };
      response = await this.fetcher(url, options);
    } catch {
      throw new PollarVerificationError(503);
    }
    if (!response.ok) {
      if (endpoint === "wallet" && response.status === 409) {
        const body = await response.clone().json().catch(() => ({}));
        if (z.object({ code: z.literal("SDK_WALLET_REQUIRED") }).safeParse(body).success) return { success: true, content: { wallets: [] } };
      }
      const nonce = response.status === 401 ? response.headers.get("DPoP-Nonce") : null;
      throw new PollarVerificationError(response.status >= 500 || response.status === 429 ? 503 : 401,
        nonce ? endpoint : undefined, nonce && nonce.length <= 2048 ? nonce : undefined);
    }
    try { return await response.json(); } catch { throw new PollarVerificationError(503); }
  }

  async verify(proof: { accessToken: string; profileProof: string; walletProof: string }): Promise<VerifiedExternalIdentity> {
    const parsedProfile = ProfileSchema.safeParse(await this.read(POLLAR_PROFILE_URL, proof.accessToken, proof.profileProof, "profile"));
    if (!parsedProfile.success) throw new PollarVerificationError(503);
    const parsedWallets = WalletStateSchema.safeParse(await this.read(POLLAR_WALLET_URL, proof.accessToken, proof.walletProof, "wallet"));
    if (!parsedWallets.success) throw new PollarVerificationError(503);
    const profile = parsedProfile.data.content;
    const providers = profile.providers;
    let configuration;
    try {
      const response = await this.fetcher(POLLAR_CONFIG_URL, { headers: {
        "x-pollar-api-key": this.apiKey, Origin: this.appOrigin
      }, redirect: "error", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error();
      configuration = z.object({ success: z.literal(true), content: z.object({ application: z.object({
        network: z.literal("testnet"), chains: z.array(z.string())
      }) }) }).parse(await response.json()).content.application;
    } catch { throw new PollarVerificationError(503); }
    if (!configuration.chains.includes("SOLANA")) throw new PollarVerificationError(401);
    const wallet = parsedWallets.data.content.wallets.find((w) => w.chain === "SOLANA" &&
      w.address && SolanaAddressSchema.safeParse(w.address).success &&
      ["devnet", "solana:devnet", "testnet"].includes(w.network ?? "") &&
      (!w.provisioning || w.provisioning === "READY"));
    // The live provider's wallet/state returns SDK_WALLET_REQUIRED for an
    // external-only SIWS session. Its authenticated profile still proves control
    // of providers.wallet.address. Accept that only for a Solana-only test app,
    // and never override an explicitly reported wallet/network conflict.
    const externalAddress = !wallet && parsedWallets.data.content.wallets.length === 0 &&
      configuration.chains.length === 1 && providers.wallet &&
      SolanaAddressSchema.safeParse(providers.wallet.address).success ? providers.wallet.address : undefined;
    let identity: Pick<VerifiedExternalIdentity, "provider" | "providerSubject">;
    if (providers.google) identity = { provider: "google", providerSubject: providers.google.id };
    else if (providers.github) identity = { provider: "github", providerSubject: providers.github.id };
    else if (providers.email) identity = { provider: "email", providerSubject: providers.email.address };
    else if (providers.wallet && ((wallet?.type === "external" && providers.wallet.address === wallet.address) || externalAddress)) {
      identity = { provider: "solana_siws", providerSubject: providers.wallet.address };
    } else throw new PollarVerificationError(401);
    const avatar = z.string().url().safeParse(profile.avatar);
    return {
      ...identity,
      displayName: [profile.first_name, profile.last_name].filter(Boolean).join(" ").slice(0, 80) || "Encore listener",
      ...(avatar.success ? { avatarUrl: avatar.data } : {}),
      ...(wallet?.address ? { walletAddress: wallet.address, walletType: wallet.type === "external" ? "external" as const : "embedded" as const } : {}),
      ...(externalAddress ? { walletAddress: externalAddress, walletType: "external" as const } : {})
    };
  }
}
