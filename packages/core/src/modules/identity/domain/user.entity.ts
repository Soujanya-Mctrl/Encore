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

export interface AuthChallengeRecord {
  readonly message: string;
  readonly nonce: string;
  readonly address: string;
  readonly intendedAction: "login" | "link_wallet";
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}
