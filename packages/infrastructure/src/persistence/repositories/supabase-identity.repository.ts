import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AuthProvider,
  OnboardingProfileInput,
  OnboardingStatus,
  UserRole,
  WalletType
} from "@encore/contracts";
import type {
  AuthChallengeRecord,
  AuthIdentityRecord,
  ChallengeRepositoryPort,
  EncoreUser,
  UserRepositoryPort,
  WalletRecord
} from "@encore/core";

export class SupabaseIdentityRepository
  implements UserRepositoryPort, ChallengeRepositoryPort
{
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  async findUserById(userId: string): Promise<EncoreUser | null> {
    const { data: profile } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return null;

    const { data: roleRows } = await this.client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    return {
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      onboardingStatus: profile.onboarding_status as OnboardingStatus,
      roles: (roleRows ?? []).map((r) => r.role as UserRole),
      createdAt: new Date(profile.created_at),
      updatedAt: new Date(profile.updated_at)
    };
  }

  async findStudioChannelForUser(userId: string) {
    const { data, error } = await this.client
      .rpc("encore_studio_channel_for_user", { p_user_id: userId })
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as Record<string, unknown>;
    return {
      id: row.id as string,
      handle: row.handle as string,
      displayName: row.display_name as string,
      role: row.role as "owner" | "editor"
    };
  }

  async listReviewAssignmentsForUser(userId: string) {
    const { data, error } = await this.client
      .rpc("encore_review_assignments_for_user", { p_user_id: userId });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      channelId: row.channel_id as string,
      createdAt: row.created_at as string
    }));
  }

  async findUserByIdentity(
    provider: AuthProvider,
    providerSubject: string
  ): Promise<EncoreUser | null> {
    const { data: identity } = await this.client
      .from("auth_identities")
      .select("user_id")
      .eq("provider", provider)
      .eq("provider_subject", providerSubject)
      .maybeSingle();

    if (!identity) return null;
    return this.findUserById(identity.user_id);
  }

  async findUserByWalletAddress(address: string): Promise<EncoreUser | null> {
    const { data: wallet } = await this.client
      .from("wallets")
      .select("user_id")
      .eq("address", address)
      .maybeSingle();

    if (!wallet) return null;
    return this.findUserById(wallet.user_id);
  }

  async createUserWithIdentity(params: {
    displayName: string;
    avatarUrl?: string | null;
    provider: AuthProvider;
    providerSubject: string;
    initialRole?: UserRole;
  }): Promise<{ user: EncoreUser; identity: AuthIdentityRecord }> {
    const { data: profile, error: pErr } = await this.client
      .from("profiles")
      .insert({
        display_name: params.displayName,
        avatar_url: params.avatarUrl ?? null,
        onboarding_status: "pending"
      })
      .select("*")
      .single();
    if (pErr || !profile) throw new Error(pErr?.message ?? "Failed to create profile");

    const role: UserRole = params.initialRole ?? "listener";
    await this.client.from("user_roles").insert({ user_id: profile.id, role });

    const { data: ident, error: iErr } = await this.client
      .from("auth_identities")
      .insert({
        user_id: profile.id,
        provider: params.provider,
        provider_subject: params.providerSubject
      })
      .select("*")
      .single();
    if (iErr || !ident) throw new Error(iErr?.message ?? "Failed to create identity");

    return {
      user: {
        id: profile.id,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        onboardingStatus: profile.onboarding_status as OnboardingStatus,
        roles: [role],
        createdAt: new Date(profile.created_at),
        updatedAt: new Date(profile.updated_at)
      },
      identity: {
        id: ident.id,
        userId: ident.user_id,
        provider: ident.provider as AuthProvider,
        providerSubject: ident.provider_subject,
        createdAt: new Date(ident.created_at)
      }
    };
  }

  async updateOnboardingProfile(
    userId: string,
    input: OnboardingProfileInput
  ): Promise<EncoreUser> {
    await this.client
      .from("profiles")
      .update({
        display_name: input.displayName,
        avatar_url: input.avatarUrl || null,
        onboarding_status: "completed",
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    await this.client
      .from("user_roles")
      .upsert({ user_id: userId, role: input.journey }, { onConflict: "user_id,role" });

    await this.client.from("user_preferences").upsert({
      user_id: userId,
      preferred_genres: input.preferredGenres,
      creative_origin_preferences: input.creativeOriginPreferences,
      onboarding_completed_at: new Date().toISOString()
    });

    const user = await this.findUserById(userId);
    if (!user) throw new Error("User not found after onboarding update");
    return user;
  }

  async upsertVerifiedWallet(params: {
    userId: string;
    address: string;
    walletType: WalletType;
    isPrimary: boolean;
  }): Promise<WalletRecord> {
    const { data, error } = await this.client
      .from("wallets")
      .upsert(
        {
          user_id: params.userId,
          chain: "solana",
          address: params.address,
          wallet_type: params.walletType,
          is_primary: params.isPrimary,
          verified_at: new Date().toISOString()
        },
        { onConflict: "address" }
      )
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to persist wallet");
    return {
      id: data.id,
      userId: data.user_id,
      chain: "solana",
      address: data.address,
      walletType: data.wallet_type as WalletType,
      verifiedAt: new Date(data.verified_at),
      isPrimary: data.is_primary
    };
  }

  async listWalletsForUser(userId: string): Promise<WalletRecord[]> {
    const { data } = await this.client.from("wallets").select("*").eq("user_id", userId);
    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      chain: "solana",
      address: row.address,
      walletType: row.wallet_type as WalletType,
      verifiedAt: new Date(row.verified_at),
      isPrimary: row.is_primary
    }));
  }

  async createChallenge(params: {
    nonce: string;
    address: string;
    intendedAction: "login" | "link_wallet";
    expiresAt: Date;
    messageDigest: string;
  }): Promise<AuthChallengeRecord> {
    const { data, error } = await this.client
      .from("auth_challenges")
      .insert({
        nonce: params.nonce,
        address: params.address,
        intended_action: params.intendedAction,
        message_digest: params.messageDigest,
        expires_at: params.expiresAt.toISOString()
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create challenge");
    return {
      nonce: data.nonce,
      address: data.address,
      intendedAction: data.intended_action as "login" | "link_wallet",
      messageDigest: data.message_digest,
      expiresAt: new Date(data.expires_at),
      consumedAt: data.consumed_at ? new Date(data.consumed_at) : null
    };
  }

  async consumeChallenge(
    nonce: string,
    address: string,
    now: Date,
    messageDigest: string,
    intendedAction: "login" | "link_wallet"
  ): Promise<AuthChallengeRecord | null> {
    const { data } = await this.client
      .from("auth_challenges")
      .update({ consumed_at: now.toISOString() })
      .eq("nonce", nonce)
      .eq("address", address)
      .eq("message_digest", messageDigest)
      .eq("intended_action", intendedAction)
      .is("consumed_at", null)
      .gt("expires_at", now.toISOString())
      .select("*")
      .maybeSingle();

    if (!data) return null;
    return {
      nonce: data.nonce,
      address: data.address,
      intendedAction: data.intended_action as "login" | "link_wallet",
      messageDigest: data.message_digest,
      expiresAt: new Date(data.expires_at),
      consumedAt: data.consumed_at ? new Date(data.consumed_at) : null
    };
  }
}
