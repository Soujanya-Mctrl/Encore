-- Catalog, Music Passport Versions & Rights Grants (RLS enabled)

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  payout_wallet text not null check (payout_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  current_version integer not null default 1,
  paused boolean not null default false,
  publish_state text not null default 'draft' check (publish_state in ('draft', 'published', 'delisted')),
  created_at timestamptz not null default now()
);

create table if not exists public.manifest_versions (
  id uuid primary key default gen_random_uuid(),
  track_id text not null references public.tracks(id) on delete cascade,
  version integer not null,
  hash text not null check (char_length(hash) = 64),
  previous_hash text check (previous_hash is null or char_length(previous_hash) = 64),
  origin_claim text not null check (origin_claim in ('HUMAN_CREATED', 'AI_ASSISTED', 'AI_GENERATED', 'UNKNOWN')),
  evidence_status text not null check (evidence_status in ('SELF_DECLARED', 'CORROBORATED', 'UNVERIFIED', 'DISPUTED')),
  rights_state text not null check (rights_state in ('PREVIEW_ALLOWED', 'EXTERNAL_LICENSE_ONLY', 'COMMERCIAL_CLEARED', 'RESTRICTED', 'DISPUTED')),
  chain_sig text,
  created_at timestamptz not null default now(),
  unique (track_id, version)
);

alter table public.artists enable row level security;
alter table public.tracks enable row level security;
alter table public.manifest_versions enable row level security;
