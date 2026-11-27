import { err, ok, type Result } from "../../../../kernel/result.js";
import type { AuthProvider, OnboardingProfileInput } from "@encore/contracts";
import { canPubliclyAssignRole, isValidSolanaAddress } from "../../domain/policies.js";
import { WalletAlreadyBoundError, type EncoreUser } from "../../domain/user.entity.js";
import type { UserRepositoryPort } from "../ports/identity.ports.js";

export async function authenticateOrCreateUser(
  repo: UserRepositoryPort,
  params: {
    provider: AuthProvider;
    providerSubject: string;
    displayName: string;
    avatarUrl?: string | null;
    walletAddress?: string;
    walletType?: "embedded" | "external";
  }
): Promise<Result<EncoreUser, Error>> {
  if (params.walletAddress && !isValidSolanaAddress(params.walletAddress)) {
    return err(new Error("Invalid Solana wallet address"));
  }

  let user = await repo.findUserByIdentity(params.provider, params.providerSubject);
  if (params.walletAddress) {
    const existingOwner = await repo.findUserByWalletAddress(params.walletAddress);
    if (existingOwner && existingOwner.id !== user?.id) {
      return err(new WalletAlreadyBoundError());
    }
  }
  if (!user) {
    const created = await repo.createUserWithIdentity({
      displayName: params.displayName,
      avatarUrl: params.avatarUrl ?? null,
      provider: params.provider,
      providerSubject: params.providerSubject,
      initialRole: "listener"
    });
    user = created.user;
  }

  if (params.walletAddress) {
    try {
      await repo.upsertVerifiedWallet({
        userId: user.id,
        address: params.walletAddress,
        walletType: params.walletType ?? "embedded",
        isPrimary: true
      });
    } catch (error) {
      if (error instanceof WalletAlreadyBoundError) return err(error);
      throw error;
    }
  }

  return ok(user);
}

export async function completeUserOnboarding(
  repo: UserRepositoryPort,
  userId: string,
  input: OnboardingProfileInput
): Promise<Result<EncoreUser, Error>> {
  if (!canPubliclyAssignRole(input.journey)) {
    return err(new Error("Role cannot be assigned via public onboarding"));
  }
  const updated = await repo.updateOnboardingProfile(userId, input);
  return ok(updated);
}
