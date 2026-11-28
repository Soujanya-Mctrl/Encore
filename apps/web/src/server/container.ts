import { randomBytes } from "node:crypto";
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
  InMemoryActiveSessions,
  SupabaseActiveSessions,
  type ActiveSessions,
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
  readonly activeSessions: ActiveSessions;
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
  const configuredSessionSecret = process.env.ENCORE_SESSION_SECRET?.trim();
  if (
    process.env.NODE_ENV === "production" &&
    (!configuredSessionSecret || configuredSessionSecret.length < 32)
  ) {
    throw new Error("ENCORE_SESSION_SECRET must be at least 32 characters in production");
  }
  const sessionSecret = configuredSessionSecret || randomBytes(32).toString("base64url");

  let repo: UserRepositoryPort & ChallengeRepositoryPort;
  if (process.env.NODE_ENV === "production" && (!supabaseUrl || !serviceRoleKey)) {
    throw new Error("Persistent identity and session storage is required in production");
  }
  let activeSessions: ActiveSessions;
  if (supabaseUrl && serviceRoleKey) {
    repo = new SupabaseIdentityRepository(supabaseUrl, serviceRoleKey);
    activeSessions = new SupabaseActiveSessions(supabaseUrl, serviceRoleKey);
  } else {
    repo = new InMemoryIdentityRepository();
    activeSessions = new InMemoryActiveSessions();
  }

  const container: ServerContainer = {
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
    users: repo,
    challenges: repo,
    verifier: new NodeEd25519Verifier(),
    activeSessions,
    sessions: new HmacSessionTokenService(sessionSecret),
    clock: { now: () => new Date() },
    externalIdentity: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY
      ? new PollarSessionVerifier(
          process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY,
          fetch,
          new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin
        )
      : null
  };

  globalForEncore.__encoreContainer = container;
  return container;
}
