import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface ActiveSessions {
  create(id: string, userId: string, expiresAt: Date): Promise<void>;
  isActive(id: string, userId: string, now: Date): Promise<boolean>;
  revoke(id: string, userId: string): Promise<void>;
}

export class SupabaseActiveSessions implements ActiveSessions {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  async create(id: string, userId: string, expiresAt: Date): Promise<void> {
    const { error } = await this.client.from("auth_sessions").insert({
      id, user_id: userId, expires_at: expiresAt.toISOString()
    });
    if (error) throw new Error("Unable to persist Encore session");
  }

  async isActive(id: string, userId: string, now: Date): Promise<boolean> {
    const { data, error } = await this.client
      .from("auth_sessions")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .gt("expires_at", now.toISOString())
      .maybeSingle();
    if (error) throw new Error("Unable to verify Encore session");
    return Boolean(data);
  }

  async revoke(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from("auth_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error("Unable to revoke Encore session");
  }
}

export class InMemoryActiveSessions implements ActiveSessions {
  private readonly sessions = new Map<string, { userId: string; expiresAt: Date }>();

  async create(id: string, userId: string, expiresAt: Date): Promise<void> {
    this.sessions.set(id, { userId, expiresAt });
  }

  async isActive(id: string, userId: string, now: Date): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) return false;
    if (session.expiresAt <= now) {
      this.sessions.delete(id);
      return false;
    }
    return session.userId === userId;
  }

  async revoke(id: string, userId: string): Promise<void> {
    if (this.sessions.get(id)?.userId === userId) this.sessions.delete(id);
  }
}
