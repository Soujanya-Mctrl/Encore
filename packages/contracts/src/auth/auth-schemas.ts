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
  provider: z.enum(["google", "email", "github"]),
  providerSubject: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().optional(),
  embeddedWalletAddress: SolanaAddressSchema.optional()
});

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
