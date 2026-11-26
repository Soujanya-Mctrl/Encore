-- Encore Identity & Wallet Onboarding Schema (Supabase Postgres, not Supabase Auth)
-- Note: Pollar is the primary authentication & wallet provider; Encore backend enforces RBAC.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  avatar_url text,
  onboarding_status text not null default 'pending'
    check (onboarding_status in ('pending', 'profile_set', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'email', 'github', 'solana_siws')),
  provider_subject text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_subject)
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chain text not null default 'solana' check (chain = 'solana'),
  address text not null unique check (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  wallet_type text not null check (wallet_type in ('embedded', 'external')),
  verified_at timestamptz not null default now(),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('listener', 'artist', 'commercial_buyer', 'reviewer', 'admin')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_genres text[] not null default '{}',
  creative_origin_preferences jsonb not null default '{"humanCreated":true,"aiAssisted":true,"aiGenerated":true,"exploreAll":true}'::jsonb,
  onboarding_completed_at timestamptz
);

create table if not exists public.auth_challenges (
  nonce text primary key,
  address text not null check (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  intended_action text not null check (intended_action in ('login', 'link_wallet')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_identities_user on public.auth_identities(user_id);
create index if not exists idx_wallets_user on public.wallets(user_id);
create index if not exists idx_auth_challenges_address on public.auth_challenges(address);

-- Enable RLS and block direct public/anon access; Next.js backend uses scoped server repositories.
alter table public.profiles enable row level security;
alter table public.auth_identities enable row level security;
alter table public.wallets enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.auth_challenges enable row level security;
