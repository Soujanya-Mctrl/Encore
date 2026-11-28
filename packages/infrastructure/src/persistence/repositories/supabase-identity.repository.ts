import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WalletAlreadyBoundError } from "@encore/core";
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
    const { data: profile, error: profileError } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw new Error("Unable to load Encore profile");
    if (!profile) return null;

    const { data: roleRows, error: rolesError } = await this.client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesError) throw new Error("Unable to load Encore roles");

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
    const { data: identity, error } = await this.client
      .from("auth_identities")
      .select("user_id")
      .eq("provider", provider)
      .eq("provider_subject", providerSubject)
      .maybeSingle();

    if (error) throw new Error("Unable to load Encore identity");
    if (!identity) return null;
    return this.findUserById(identity.user_id);
  }

  async findUserByWalletAddress(address: string): Promise<EncoreUser | null> {
    const { data: wallet, error } = await this.client
      .from("wallets")
      .select("user_id")
      .eq("address", address)
      .maybeSingle();

    if (error) throw new Error("Unable to load Encore wallet");
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
    if (params.initialRole && params.initialRole !== "listener") {
      throw new Error("Identity provisioning cannot grant an elevated role");
    }
    const { data: ident, error } = await this.client
      .rpc("provision_encore_identity", {
        p_provider: params.provider,
        p_subject: params.providerSubject,
        p_display_name: params.displayName,
        p_avatar_url: params.avatarUrl ?? null
      })
      .single();
    if (error || !ident) throw new Error(error?.message ?? "Failed to create identity");
    const identityRow = ident as Record<string, unknown>;
    const user = await this.findUserById(identityRow.user_id as string);
    if (!user) throw new Error("User not found after identity provisioning");

    return {
      user,
      identity: {
        id: identityRow.id as string,
        userId: identityRow.user_id as string,
        provider: identityRow.provider as AuthProvider,
        providerSubject: identityRow.provider_subject as string,
        createdAt: new Date(identityRow.created_at as string)
      }
    };
  }

  async updateOnboardingProfile(
    userId: string,
    input: OnboardingProfileInput
  ): Promise<EncoreUser> {
    const { error } = await this.client.rpc("complete_encore_onboarding", {
      p_user_id: userId,
      p_display_name: input.displayName,
      p_avatar_url: input.avatarUrl || null,
      p_journey: input.journey,
      p_preferred_genres: input.preferredGenres,
      p_origin_preferences: input.creativeOriginPreferences
    });
    if (error) throw new Error(error.message);

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
      .rpc("bind_encore_verified_wallet", {
        p_user_id: params.userId,
        p_address: params.address,
        p_wallet_type: params.walletType,
        p_is_primary: params.isPrimary
      })
      .single();

    if (error?.code === "23505") throw new WalletAlreadyBoundError();
    if (error || !data) throw new Error(error?.message ?? "Failed to persist wallet");
    const wallet = data as Record<string, unknown>;
    return {
      id: wallet.id as string,
      userId: wallet.user_id as string,
      chain: "solana",
      address: wallet.address as string,
      walletType: wallet.wallet_type as WalletType,
      verifiedAt: new Date(wallet.verified_at as string),
      isPrimary: wallet.is_primary as boolean
    };
  }

  async listWalletsForUser(userId: string): Promise<WalletRecord[]> {
    const { data, error } = await this.client.from("wallets").select("*").eq("user_id", userId);
    if (error) throw new Error("Unable to load Encore wallets");
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
    message: string;
    nonce: string;
    address: string;
    intendedAction: "login" | "link_wallet";
    expiresAt: Date;
    messageDigest: string;
  }): Promise<AuthChallengeRecord> {
    const { data, error } = await this.client
      .from("auth_challenges")
      .insert({
        message: params.message,
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
      message: data.message,
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
    const { data, error } = await this.client
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

    if (error) throw new Error("Unable to consume wallet challenge");
    if (!data) return null;
    return {
      message: data.message,
      nonce: data.nonce,
      address: data.address,
      intendedAction: data.intended_action as "login" | "link_wallet",
      messageDigest: data.message_digest,
      expiresAt: new Date(data.expires_at),
      consumedAt: data.consumed_at ? new Date(data.consumed_at) : null
    };
  }
}
