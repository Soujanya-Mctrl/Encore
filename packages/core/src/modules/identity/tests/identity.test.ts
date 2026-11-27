import { describe, expect, it } from "vitest";
import {
  authenticateOrCreateUser,
  canAccessArtistStudio,
  canPubliclyAssignRole,
  completeUserOnboarding,
  isValidSolanaAddress,
  verifyWalletChallenge
} from "../index.js";
import type {
  AuthChallengeRecord,
  AuthIdentityRecord,
  ChallengeRepositoryPort,
  EncoreUser,
  SignatureVerifierPort,
  UserRepositoryPort,
  WalletRecord
} from "../index.js";

function createFakeRepo(): UserRepositoryPort & ChallengeRepositoryPort {
  const users = new Map<string, EncoreUser>();
  const idents = new Map<string, AuthIdentityRecord>();
  const wallets = new Map<string, WalletRecord>();
  const challenges = new Map<string, AuthChallengeRecord>();
  let seq = 1;

  return {
    async findUserById(id) {
      return users.get(id) ?? null;
    },
    async findUserByIdentity(provider, subject) {
      const ident = idents.get(`${provider}:${subject}`);
      return ident ? (users.get(ident.userId) ?? null) : null;
    },
    async findUserByWalletAddress(addr) {
      const w = wallets.get(addr);
      return w ? (users.get(w.userId) ?? null) : null;
    },
    async createUserWithIdentity(p) {
      const id = `u-${seq++}`;
      const user: EncoreUser = {
        id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? null,
        onboardingStatus: "pending",
        roles: [p.initialRole ?? "listener"],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const identity: AuthIdentityRecord = {
        id: `i-${seq++}`,
        userId: id,
        provider: p.provider,
        providerSubject: p.providerSubject,
        createdAt: new Date()
      };
      users.set(id, user);
      idents.set(`${p.provider}:${p.providerSubject}`, identity);
      return { user, identity };
    },
    async updateOnboardingProfile(userId, input) {
      const u = users.get(userId)!;
      const updated: EncoreUser = {
        ...u,
        displayName: input.displayName,
        onboardingStatus: "completed",
        roles: u.roles.includes(input.journey) ? u.roles : [...u.roles, input.journey]
      };
      users.set(userId, updated);
      return updated;
    },
    async upsertVerifiedWallet(p) {
      const rec: WalletRecord = {
        id: `w-${seq++}`,
        userId: p.userId,
        chain: "solana",
        address: p.address,
        walletType: p.walletType,
        verifiedAt: new Date(),
        isPrimary: p.isPrimary
      };
      wallets.set(p.address, rec);
      return rec;
    },
    async listWalletsForUser(userId) {
      return Array.from(wallets.values()).filter((w) => w.userId === userId);
    },
    async createChallenge(p) {
      const rec: AuthChallengeRecord = { ...p, consumedAt: null };
      challenges.set(p.nonce, rec);
      return rec;
    },
    async consumeChallenge(nonce, address, now, digest, intendedAction) {
      const rec = challenges.get(nonce);
      if (!rec || rec.address !== address || rec.messageDigest !== digest || rec.intendedAction !== intendedAction || rec.consumedAt || rec.expiresAt <= now) return null;
      const consumed = { ...rec, consumedAt: now };
      challenges.set(nonce, consumed);
      return consumed;
    }
  };
}

const VALID_ADDR = "11111111111111111111111111111111";
const VALID_ADDR_2 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

describe("Identity Domain & Policies", () => {
  it("validates Solana base58 addresses", () => {
    expect(isValidSolanaAddress(VALID_ADDR)).toBe(true);
    expect(isValidSolanaAddress("not-a-solana-address")).toBe(false);
  });

  it("blocks privileged role assignment via public onboarding", () => {
    expect(canPubliclyAssignRole("listener")).toBe(true);
    expect(canPubliclyAssignRole("artist")).toBe(true);
    expect(canPubliclyAssignRole("reviewer")).toBe(false);
    expect(canPubliclyAssignRole("admin")).toBe(false);
    expect(canAccessArtistStudio(["listener"])).toBe(false);
    expect(canAccessArtistStudio(["listener", "artist"])).toBe(true);
  });

  it("is idempotent on repeated login and prevents cross-account wallet binding", async () => {
    const repo = createFakeRepo();
    const first = await authenticateOrCreateUser(repo, {
      provider: "google",
      providerSubject: "g-123",
      displayName: "Alice",
      walletAddress: VALID_ADDR,
      walletType: "embedded"
    });
    expect(first.ok).toBe(true);

    const second = await authenticateOrCreateUser(repo, {
      provider: "google",
      providerSubject: "g-123",
      displayName: "Alice",
      walletAddress: VALID_ADDR,
      walletType: "embedded"
    });
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.id).toBe(first.value.id);
    }

    const hijack = await authenticateOrCreateUser(repo, {
      provider: "email",
      providerSubject: "bob@example.com",
      displayName: "Bob",
      walletAddress: VALID_ADDR,
      walletType: "embedded"
    });
    expect(hijack.ok).toBe(false);
  });

  it("rejects replayed or expired SIWS challenges", async () => {
    const repo = createFakeRepo();
    const verifier: SignatureVerifierPort = { verifyEd25519: async () => true };
    const now = new Date("2026-11-26T12:00:00Z");
    const clock = { now: () => now };

    await repo.createChallenge({
      nonce: "nonce-1234567890123456",
      address: VALID_ADDR_2,
      intendedAction: "login",
      messageDigest: "a".repeat(64),
      expiresAt: new Date("2026-11-26T12:05:00Z")
    });

    const msg = `Encore login ${VALID_ADDR_2} nonce-1234567890123456`;
    const mismatched = await verifyWalletChallenge(repo, verifier, clock, {
      address: VALID_ADDR_2,
      nonce: "nonce-1234567890123456",
      message: msg,
      messageDigest: "b".repeat(64),
      intendedAction: "login",
      signatureBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    });
    expect(mismatched.ok).toBe(false);

    const okRes = await verifyWalletChallenge(repo, verifier, clock, {
      address: VALID_ADDR_2,
      nonce: "nonce-1234567890123456",
      message: msg,
      messageDigest: "a".repeat(64),
      intendedAction: "login",
      signatureBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    });
    expect(okRes.ok).toBe(true);

    const replayRes = await verifyWalletChallenge(repo, verifier, clock, {
      address: VALID_ADDR_2,
      nonce: "nonce-1234567890123456",
      message: msg,
      messageDigest: "a".repeat(64),
      intendedAction: "login",
      signatureBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    });
    expect(replayRes.ok).toBe(false);
  });

  it("completes onboarding and assigns artist journey role", async () => {
    const repo = createFakeRepo();
    const created = await authenticateOrCreateUser(repo, {
      provider: "email",
      providerSubject: "artist@example.com",
      displayName: "Aria"
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const onboarded = await completeUserOnboarding(repo, created.value.id, {
      displayName: "Aria Sound",
      avatarUrl: "",
      journey: "artist",
      preferredGenres: ["Ambient"],
      creativeOriginPreferences: {
        humanCreated: true,
        aiAssisted: false,
        aiGenerated: false,
        exploreAll: false
      }
    });
    expect(onboarded.ok).toBe(true);
    if (onboarded.ok) {
      expect(onboarded.value.onboardingStatus).toBe("completed");
      expect(onboarded.value.roles).toContain("artist");
    }
  });
});
