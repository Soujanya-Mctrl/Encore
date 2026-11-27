import type {
  AuthProvider,
  OnboardingProfileInput,
  UserRole,
  WalletType
} from "@encore/contracts";
import type {
  AuthChallengeRecord,
  AuthIdentityRecord,
  EncoreUser,
  ReviewAssignmentAccess,
  StudioChannelAccess,
  WalletRecord
} from "../../domain/user.entity.js";

export interface UserRepositoryPort {
  findUserById(userId: string): Promise<EncoreUser | null>;
  findStudioChannelForUser(userId: string): Promise<StudioChannelAccess | null>;
  listReviewAssignmentsForUser(userId: string): Promise<ReviewAssignmentAccess[]>;
  findUserByIdentity(
    provider: AuthProvider,
    providerSubject: string
  ): Promise<EncoreUser | null>;
  findUserByWalletAddress(address: string): Promise<EncoreUser | null>;
  createUserWithIdentity(params: {
    displayName: string;
    avatarUrl?: string | null;
    provider: AuthProvider;
    providerSubject: string;
    initialRole?: UserRole;
  }): Promise<{ user: EncoreUser; identity: AuthIdentityRecord }>;
  updateOnboardingProfile(
    userId: string,
    input: OnboardingProfileInput
  ): Promise<EncoreUser>;
  upsertVerifiedWallet(params: {
    userId: string;
    address: string;
    walletType: WalletType;
    isPrimary: boolean;
  }): Promise<WalletRecord>;
  listWalletsForUser(userId: string): Promise<WalletRecord[]>;
}

export interface ChallengeRepositoryPort {
  createChallenge(params: {
    nonce: string;
    address: string;
    intendedAction: "login" | "link_wallet";
    expiresAt: Date;
    messageDigest: string;
  }): Promise<AuthChallengeRecord>;
  consumeChallenge(
    nonce: string,
    address: string,
    now: Date,
    messageDigest: string,
    intendedAction: AuthChallengeRecord["intendedAction"]
  ): Promise<AuthChallengeRecord | null>;
}

export interface SignatureVerifierPort {
  verifyEd25519(params: {
    address: string;
    message: string;
    signatureBase64: string;
  }): Promise<boolean>;
}

export interface SessionTokenPort {
  issueSessionToken(payload: {
    userId: string;
    roles: readonly UserRole[];
    sessionId: string;
  }): Promise<string>;
  verifySessionToken(token: string): Promise<{
    userId: string;
    roles: readonly UserRole[];
    sessionId: string;
  } | null>;
}
