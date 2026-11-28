import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PkceCodeRepositoryPort } from "@encore/core";

type StoredCode = Parameters<PkceCodeRepositoryPort["create"]>[0];
type CodeProof = Parameters<PkceCodeRepositoryPort["consume"]>[0];

export class SupabasePkceCodes implements PkceCodeRepositoryPort {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  async create(code: StoredCode): Promise<void> {
    const { error } = await this.client.from("auth_pkce_codes").insert({
      code_hash: code.codeHash,
      user_id: code.userId,
      source_session_id: code.sourceSessionId,
      code_challenge: code.codeChallenge,
      redirect_uri: code.redirectUri,
      expires_at: code.expiresAt.toISOString()
    });
    if (error) throw new Error("Unable to persist authorization code");
  }

  async consume(proof: CodeProof) {
    // Match and delete in a single statement. A bad verifier cannot burn a
    // legitimate code, and replicas cannot both exchange the same code.
    const { data, error } = await this.client
      .from("auth_pkce_codes")
      .delete()
      .eq("code_hash", proof.codeHash)
      .eq("code_challenge", proof.codeChallenge)
      .eq("redirect_uri", proof.redirectUri)
      .gt("expires_at", proof.now.toISOString())
      .select("user_id,source_session_id")
      .maybeSingle();
    if (error) throw new Error("Unable to consume authorization code");
    return data ? { userId: data.user_id as string, sourceSessionId: data.source_session_id as string } : null;
  }
}

export class InMemoryPkceCodes implements PkceCodeRepositoryPort {
  private readonly codes = new Map<string, StoredCode>();

  async create(code: StoredCode): Promise<void> {
    const now = Date.now();
    for (const entry of this.codes.values()) {
      if (entry.expiresAt.getTime() <= now) this.codes.delete(entry.codeHash);
    }
    this.codes.set(code.codeHash, code);
  }

  async consume(proof: CodeProof) {
    const entry = this.codes.get(proof.codeHash);
    if (!entry || entry.expiresAt <= proof.now || entry.codeChallenge !== proof.codeChallenge ||
      entry.redirectUri !== proof.redirectUri) return null;
    this.codes.delete(proof.codeHash);
    return { userId: entry.userId, sourceSessionId: entry.sourceSessionId };
  }
}
