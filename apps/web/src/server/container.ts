import { randomBytes } from "node:crypto";
import type {
  ChallengeRepositoryPort,
  ClockPort,
  ExternalIdentityVerifierPort,
  MarketplaceChainPort,
  MarketplaceRepositoryPort,
  PkceCodeRepositoryPort,
  QueuePort,
  SessionTokenPort,
  SignatureVerifierPort,
  UserRepositoryPort
} from "@encore/core";
import {
  HmacSessionTokenService,
  InMemoryActiveSessions,
  InMemoryPkceCodes,
  SupabasePkceCodes,
  SupabaseActiveSessions,
  type ActiveSessions,
  InMemoryIdentityRepository,
  InMemoryMarketplaceRepository,
  NodeEd25519Verifier,
  PgmqAdapter,
  PollarSessionVerifier,
  SolanaMarketplaceChainAdapter,
  SupabaseIdentityRepository,
  SupabaseMarketplaceRepository
} from "@encore/infrastructure";
import { getBrowserAuthOrigin } from "./browser-auth-request";

export interface ServerContainer {
  readonly cluster: string;
  readonly users: UserRepositoryPort;
  readonly challenges: ChallengeRepositoryPort;
  readonly verifier: SignatureVerifierPort;
  readonly activeSessions: ActiveSessions;
  readonly pkceCodes: PkceCodeRepositoryPort;
  readonly sessions: SessionTokenPort;
  readonly marketplace: MarketplaceRepositoryPort;
  readonly chain: MarketplaceChainPort;
  readonly queue: QueuePort;
  readonly clock: ClockPort;
  readonly externalIdentity: ExternalIdentityVerifierPort | null;
}

const globalForEncore = globalThis as unknown as {
  __encoreContainer?: ServerContainer;
};

export function getServerContainer(): ServerContainer {
  if (globalForEncore.__encoreContainer) {
    return globalForEncore.__encoreContainer;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const configuredSessionSecret = process.env.ENCORE_SESSION_SECRET?.trim();
  const production = process.env.NODE_ENV === "production";
  if (
    production &&
    (!configuredSessionSecret || configuredSessionSecret.length < 32)
  ) {
    throw new Error("ENCORE_SESSION_SECRET must be at least 32 characters in production");
  }
  const sessionSecret = configuredSessionSecret || randomBytes(32).toString("base64url");

  const identityStore = process.env.ENCORE_IDENTITY_STORE;
  const supabaseIdentity = identityStore !== "memory" && supabaseUrl && serviceRoleKey
    ? { url: supabaseUrl, key: serviceRoleKey }
    : null;
  if ((production || identityStore === "supabase") && !supabaseIdentity) {
    throw new Error("Persistent identity and session storage requires Supabase credentials");
  }

  const repo = supabaseIdentity
    ? new SupabaseIdentityRepository(supabaseIdentity.url, supabaseIdentity.key)
    : new InMemoryIdentityRepository();
  const pollarKey = process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY;
  const authOrigin = getBrowserAuthOrigin();
  const container: ServerContainer = {
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
    users: repo,
    challenges: repo,
    verifier: new NodeEd25519Verifier(),
    activeSessions: supabaseIdentity
      ? new SupabaseActiveSessions(supabaseIdentity.url, supabaseIdentity.key)
      : new InMemoryActiveSessions(),
    pkceCodes: supabaseIdentity
      ? new SupabasePkceCodes(supabaseIdentity.url, supabaseIdentity.key)
      : new InMemoryPkceCodes(),
    sessions: new HmacSessionTokenService(sessionSecret),
    marketplace: supabaseUrl && serviceRoleKey
      ? new SupabaseMarketplaceRepository(supabaseUrl, serviceRoleKey)
      : new InMemoryMarketplaceRepository(),
    chain: new SolanaMarketplaceChainAdapter(process.env.NEXT_PUBLIC_ENCORE_PROGRAM_ID),
    queue: new PgmqAdapter(supabaseUrl, serviceRoleKey),
    clock: { now: () => new Date() },
    externalIdentity: pollarKey && authOrigin
      ? new PollarSessionVerifier(pollarKey, fetch, authOrigin)
      : null
  };

  globalForEncore.__encoreContainer = container;
  return container;
}
