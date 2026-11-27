import type {
  AuthProvider,
  OnboardingStatus,
  UserRole,
  WalletType
} from "@encore/contracts";

export interface EncoreUser {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly onboardingStatus: OnboardingStatus;
  readonly roles: readonly UserRole[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AuthIdentityRecord {
  readonly id: string;
  readonly userId: string;
  readonly provider: AuthProvider;
  readonly providerSubject: string;
  readonly createdAt: Date;
}

export interface WalletRecord {
  readonly id: string;
  readonly userId: string;
  readonly chain: "solana";
  readonly address: string;
  readonly walletType: WalletType;
  readonly verifiedAt: Date;
  readonly isPrimary: boolean;
}

export interface StudioChannelAccess {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly role: "owner" | "editor";
}

export interface ReviewAssignmentAccess {
  readonly id: string;
  readonly channelId: string;
  readonly createdAt: string;
}

export class WalletAlreadyBoundError extends Error {
  constructor() {
    super("Wallet is already bound to another Encore account");
    this.name = "WalletAlreadyBoundError";
  }
}

export interface AuthChallengeRecord {
  readonly nonce: string;
  readonly address: string;
  readonly intendedAction: "login" | "link_wallet";
  readonly messageDigest: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}
