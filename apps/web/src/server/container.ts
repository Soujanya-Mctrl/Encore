import type {
  ChallengeRepositoryPort,
  ClockPort,
  ExternalIdentityVerifierPort,
  SessionTokenPort,
  SignatureVerifierPort,
  UserRepositoryPort
} from "@encore/core";
import {
  HmacSessionTokenService,
  InMemoryIdentityRepository,
  NodeEd25519Verifier,
  PollarSessionVerifier,
  SupabaseIdentityRepository
} from "@encore/infrastructure";

export interface ServerContainer {
  readonly cluster: string;
  readonly users: UserRepositoryPort;
  readonly challenges: ChallengeRepositoryPort;
  readonly verifier: SignatureVerifierPort;
  readonly sessions: SessionTokenPort;
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
  const sessionSecret = process.env.ENCORE_SESSION_SECRET;
  if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error("Set ENCORE_SESSION_SECRET to at least 32 random bytes in apps/web/.env.local");
  }

  let repo: UserRepositoryPort & ChallengeRepositoryPort;
  if (process.env.ENCORE_IDENTITY_STORE === "memory" && process.env.NODE_ENV !== "production") {
    repo = new InMemoryIdentityRepository();
  } else if (supabaseUrl && serviceRoleKey) {
    repo = new SupabaseIdentityRepository(supabaseUrl, serviceRoleKey);
  } else {
    throw new Error("Configure Supabase, or explicitly use ENCORE_IDENTITY_STORE=memory for local development");
  }

  const container: ServerContainer = {
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
    users: repo,
    challenges: repo,
    verifier: new NodeEd25519Verifier(),
    sessions: new HmacSessionTokenService(sessionSecret),
    clock: { now: () => new Date() },
    externalIdentity: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY
      ? new PollarSessionVerifier(process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY, fetch,
        new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin)
      : null
  };

  globalForEncore.__encoreContainer = container;
  return container;
}
