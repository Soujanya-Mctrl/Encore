import crypto from "node:crypto";
import type {
  AuthProvider,
  OnboardingProfileInput,
  UserRole,
  WalletType
} from "@encore/contracts";
import {
  WalletAlreadyBoundError,
  type AuthChallengeRecord,
  type AuthIdentityRecord,
  type ChallengeRepositoryPort,
  type EncoreUser,
  type ReviewAssignmentAccess,
  type StudioChannelAccess,
  type UserRepositoryPort,
  type WalletRecord
} from "@encore/core";

export class InMemoryIdentityRepository
  implements UserRepositoryPort, ChallengeRepositoryPort
{
  private readonly users = new Map<string, EncoreUser>();
  private readonly channels = new Map<string, StudioChannelAccess>();
  private readonly preferences = new Map<string, OnboardingProfileInput>();
  private readonly identities = new Map<string, AuthIdentityRecord>();
  private readonly wallets = new Map<string, WalletRecord>();
  private readonly challenges = new Map<string, AuthChallengeRecord>();

  async findUserById(userId: string): Promise<EncoreUser | null> {
    return this.users.get(userId) ?? null;
  }

  async findStudioChannelForUser(userId: string): Promise<StudioChannelAccess | null> {
    return this.channels.get(userId) ?? null;
  }

  async listReviewAssignmentsForUser(_userId: string): Promise<ReviewAssignmentAccess[]> {
    return [];
  }

  async findUserByIdentity(
    provider: AuthProvider,
    providerSubject: string
  ): Promise<EncoreUser | null> {
    const key = `${provider}:${providerSubject}`;
    const identity = this.identities.get(key);
    if (!identity) return null;
    return this.users.get(identity.userId) ?? null;
  }

  async findUserByWalletAddress(address: string): Promise<EncoreUser | null> {
    const wallet = this.wallets.get(address);
    if (!wallet) return null;
    return this.users.get(wallet.userId) ?? null;
  }

  async createUserWithIdentity(params: {
    displayName: string;
    avatarUrl?: string | null;
    provider: AuthProvider;
    providerSubject: string;
    initialRole?: UserRole;
  }): Promise<{ user: EncoreUser; identity: AuthIdentityRecord }> {
    const identityKey = `${params.provider}:${params.providerSubject}`;
    const existing = this.identities.get(identityKey);
    const existingUser = existing && this.users.get(existing.userId);
    if (existing && existingUser) return { user: existingUser, identity: existing };

    const now = new Date();
    const userId = crypto.randomUUID();
    const user: EncoreUser = {
      id: userId,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl ?? null,
      onboardingStatus: "pending",
      roles: [params.initialRole ?? "listener"],
      createdAt: now,
      updatedAt: now
    };
    const identity: AuthIdentityRecord = {
      id: crypto.randomUUID(),
      userId,
      provider: params.provider,
      providerSubject: params.providerSubject,
      createdAt: now
    };
    this.users.set(userId, user);
    this.identities.set(identityKey, identity);
    return { user, identity };
  }

  async updateOnboardingProfile(
    userId: string,
    input: OnboardingProfileInput
  ): Promise<EncoreUser> {
    const existing = this.users.get(userId);
    if (!existing) throw new Error("User not found");
    if (input.journey !== "listener" && input.journey !== "artist") {
      throw new Error("Invalid public onboarding role");
    }
    const roles = existing.roles.includes(input.journey)
      ? existing.roles
      : [...existing.roles, input.journey];
    const updated: EncoreUser = {
      ...existing,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ? input.avatarUrl : existing.avatarUrl,
      onboardingStatus: "completed",
      roles,
      updatedAt: new Date()
    };
    if (input.journey === "artist" && !this.channels.has(userId)) {
      this.channels.set(userId, {
        id: crypto.randomUUID(),
        handle: `artist-${userId}`,
        displayName: input.displayName,
        role: "owner"
      });
    }
    this.users.set(userId, updated);
    this.preferences.set(userId, input);
    return updated;
  }

  async upsertVerifiedWallet(params: {
    userId: string;
    address: string;
    walletType: WalletType;
    isPrimary: boolean;
  }): Promise<WalletRecord> {
    const existing = this.wallets.get(params.address);
    if (existing && existing.userId !== params.userId) {
      throw new WalletAlreadyBoundError();
    }
    const record: WalletRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      userId: params.userId,
      chain: "solana",
      address: params.address,
      walletType: params.walletType,
      verifiedAt: new Date(),
      isPrimary: params.isPrimary
    };
    this.wallets.set(params.address, record);
    return record;
  }

  async listWalletsForUser(userId: string): Promise<WalletRecord[]> {
    return Array.from(this.wallets.values()).filter((w) => w.userId === userId);
  }

  async createChallenge(params: {
    nonce: string;
    address: string;
    intendedAction: "login" | "link_wallet";
    expiresAt: Date;
    messageDigest: string;
  }): Promise<AuthChallengeRecord> {
    const record: AuthChallengeRecord = {
      nonce: params.nonce,
      address: params.address,
      intendedAction: params.intendedAction,
      expiresAt: params.expiresAt,
      messageDigest: params.messageDigest,
      consumedAt: null
    };
    this.challenges.set(params.nonce, record);
    return record;
  }

  async consumeChallenge(
    nonce: string,
    address: string,
    now: Date,
    messageDigest: string,
    intendedAction: AuthChallengeRecord["intendedAction"]
  ): Promise<AuthChallengeRecord | null> {
    const record = this.challenges.get(nonce);
    if (!record) return null;
    if (
      record.address !== address ||
      record.messageDigest !== messageDigest ||
      record.intendedAction !== intendedAction
    ) return null;
    if (record.consumedAt !== null) return null;
    if (record.expiresAt.getTime() <= now.getTime()) return null;

    const consumed: AuthChallengeRecord = {
      ...record,
      consumedAt: now
    };
    this.challenges.set(nonce, consumed);
    return consumed;
  }
}
