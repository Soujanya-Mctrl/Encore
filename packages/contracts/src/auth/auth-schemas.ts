import { z } from "zod";

export const USER_ROLES = [
  "listener",
  "artist",
  "commercial_buyer",
  "reviewer",
  "admin"
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PUBLIC_ASSIGNABLE_ROLES = ["listener", "artist", "commercial_buyer"] as const;

export const AUTH_PROVIDERS = ["google", "email", "github", "solana_siws"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const WALLET_TYPES = ["embedded", "external"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const ONBOARDING_STATUSES = ["pending", "profile_set", "completed"] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const SolanaAddressSchema = z
  .string()
  .regex(SOLANA_ADDRESS_REGEX, "Invalid base58 Solana address");

export const SiwsChallengeRequestSchema = z.object({
  address: SolanaAddressSchema,
  intendedAction: z.enum(["login", "link_wallet"]).default("login")
});

export const SiwsVerifyRequestSchema = z.object({
  address: SolanaAddressSchema,
  nonce: z.string().min(16),
  message: z.string().min(10),
  signatureBase64: z.string().min(32),
  walletProvider: z.string().min(1).default("wallet_standard")
});

export const PollarSessionExchangeSchema = z.object({
  accessToken: z.string().min(1).max(16384),
  profileProof: z.string().min(1).max(8192),
  walletProof: z.string().min(1).max(8192)
}).strict();

// Fixed upstream targets: the browser cannot choose a URL for server-side fetches.
export const POLLAR_PROFILE_URL = "https://sdk.api.pollar.xyz/v3/auth/session/resume";
export const POLLAR_WALLET_URL = "https://sdk.api.pollar.xyz/v3/wallet/state";
export const POLLAR_CONFIG_URL = "https://sdk.api.pollar.xyz/v3/applications/config";

export const OnboardingProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  journey: z.enum(["listener", "artist"]),
  preferredGenres: z.array(z.string().min(1).max(40)).max(12).default([]),
  creativeOriginPreferences: z
    .object({
      humanCreated: z.boolean().default(true),
      aiAssisted: z.boolean().default(true),
      aiGenerated: z.boolean().default(true),
      exploreAll: z.boolean().default(true)
    })
    .default({
      humanCreated: true,
      aiAssisted: true,
      aiGenerated: true,
      exploreAll: true
    })
});

export type OnboardingProfileInput = z.infer<typeof OnboardingProfileSchema>;
export type SiwsChallengeRequest = z.infer<typeof SiwsChallengeRequestSchema>;
export type SiwsVerifyRequest = z.infer<typeof SiwsVerifyRequestSchema>;
export type PollarSessionExchange = z.infer<typeof PollarSessionExchangeSchema>;

export const EXPO_NATIVE_REDIRECT_URI = "encore://auth/callback";

export const PkceCodeRequestSchema = z.object({
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Use an S256 PKCE challenge"),
  redirectUri: z.string().url().max(512)
}).strict();

export const PkceBrowserRequestSchema = PkceCodeRequestSchema.extend({
  state: z.string().regex(/^[A-Za-z0-9_-]{22,128}$/)
});

export const PkceExchangeRequestSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  redirectUri: z.string().url().max(512)
}).strict();

export type PkceCodeRequest = z.infer<typeof PkceCodeRequestSchema>;
export type PkceBrowserRequest = z.infer<typeof PkceBrowserRequestSchema>;
export type PkceExchangeRequest = z.infer<typeof PkceExchangeRequestSchema>;

type IsoTimestamp = string;

export interface EncoreAuthSnapshot {
  readonly user: {
    readonly id: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly onboardingStatus: OnboardingStatus;
    readonly roles: readonly UserRole[];
    readonly createdAt: IsoTimestamp;
    readonly updatedAt: IsoTimestamp;
  };
  readonly wallets: readonly {
    readonly id: string;
    readonly userId: string;
    readonly chain: "solana";
    readonly address: string;
    readonly walletType: WalletType;
    readonly verifiedAt: IsoTimestamp;
    readonly isPrimary: boolean;
  }[];
}

export interface ExpoSessionResponse extends EncoreAuthSnapshot {
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly expiresInSeconds: number;
}

export interface OnboardingResponse extends EncoreAuthSnapshot {
  readonly studioChannel: {
    readonly id: string;
    readonly handle: string;
    readonly displayName: string;
    readonly role: "owner" | "editor";
  } | null;
}
