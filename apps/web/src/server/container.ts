import type {
  ChallengeRepositoryPort,
  ClockPort,
  MarketplaceChainPort,
  MarketplaceRepositoryPort,
  QueuePort,
  SessionTokenPort,
  SignatureVerifierPort,
  UserRepositoryPort
} from "@encore/core";
import {
  HmacSessionTokenService,
  InMemoryIdentityRepository,
  InMemoryMarketplaceRepository,
  NodeEd25519Verifier,
  PgmqAdapter,
  SolanaMarketplaceChainAdapter,
  SupabaseIdentityRepository
} from "@encore/infrastructure";

export interface ServerContainer {
  readonly cluster: string;
  readonly users: UserRepositoryPort;
  readonly challenges: ChallengeRepositoryPort;
  readonly verifier: SignatureVerifierPort;
  readonly sessions: SessionTokenPort;
  readonly marketplace: MarketplaceRepositoryPort;
  readonly chain: MarketplaceChainPort;
  readonly queue: QueuePort;
  readonly clock: ClockPort;
}

const globalForEncore = globalThis as unknown as {
  __encoreContainer?: ServerContainer;
};

export function getServerContainer(): ServerContainer {
  if (globalForEncore.__encoreContainer) {
    return globalForEncore.__encoreContainer;
  }

  const isProd = process.env.NODE_ENV === "production";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.ENCORE_SESSION_SECRET;

  if (isProd && (!sessionSecret || sessionSecret.length < 32)) {
    throw new Error(
      "ENCORE_SESSION_SECRET (>=32 chars) is required in production. Refusing to start with ephemeral secret."
    );
  }
  if (isProd && (!supabaseUrl || !serviceRoleKey)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production."
    );
  }

  const identityRepo: UserRepositoryPort & ChallengeRepositoryPort =
    supabaseUrl && serviceRoleKey
      ? new SupabaseIdentityRepository(supabaseUrl, serviceRoleKey)
      : new InMemoryIdentityRepository();

  const container: ServerContainer = {
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
    users: identityRepo,
    challenges: identityRepo,
    verifier: new NodeEd25519Verifier(),
    sessions: new HmacSessionTokenService(
      sessionSecret || "encore-devnet-ephemeral-session-secret-change-me"
    ),
    marketplace: new InMemoryMarketplaceRepository(),
    chain: new SolanaMarketplaceChainAdapter(process.env.NEXT_PUBLIC_ENCORE_PROGRAM_ID),
    queue: new PgmqAdapter(supabaseUrl, serviceRoleKey),
    clock: { now: () => new Date() }
  };

  globalForEncore.__encoreContainer = container;
  return container;
}
