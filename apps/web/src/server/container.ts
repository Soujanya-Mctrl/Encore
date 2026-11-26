import type {
  ChallengeRepositoryPort,
  ClockPort,
  SessionTokenPort,
  SignatureVerifierPort,
  UserRepositoryPort
} from "@encore/core";
import {
  HmacSessionTokenService,
  InMemoryIdentityRepository,
  NodeEd25519Verifier,
  SupabaseIdentityRepository
} from "@encore/infrastructure";

export interface ServerContainer {
  readonly cluster: string;
  readonly users: UserRepositoryPort;
  readonly challenges: ChallengeRepositoryPort;
  readonly verifier: SignatureVerifierPort;
  readonly sessions: SessionTokenPort;
  readonly clock: ClockPort;
}

const globalForEncore = globalThis as unknown as {
  __encoreContainer?: ServerContainer;
};

export function getServerContainer(): ServerContainer {
  if (globalForEncore.__encoreContainer) {
    return globalForEncore.__encoreContainer;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret =
    process.env.ENCORE_SESSION_SECRET || "encore-devnet-ephemeral-session-secret-change-me";

  let repo: UserRepositoryPort & ChallengeRepositoryPort;
  if (supabaseUrl && serviceRoleKey) {
    repo = new SupabaseIdentityRepository(supabaseUrl, serviceRoleKey);
  } else {
    repo = new InMemoryIdentityRepository();
  }

  const container: ServerContainer = {
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
    users: repo,
    challenges: repo,
    verifier: new NodeEd25519Verifier(),
    sessions: new HmacSessionTokenService(sessionSecret),
    clock: { now: () => new Date() }
  };

  globalForEncore.__encoreContainer = container;
  return container;
}
