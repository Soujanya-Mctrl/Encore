-- Layer 1: Direct Support Receipts & Supporter Passes (RLS enabled)

create table if not exists public.support_receipts (
  id uuid primary key default gen_random_uuid(),
  payer_user_id uuid not null references public.profiles(id) on delete restrict,
  payer_wallet text not null check (payer_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  track_id text not null references public.tracks(id) on delete restrict,
  passport_version integer not null,
  manifest_hash text not null check (char_length(manifest_hash) = 64),
  amount_smallest_units numeric not null check (amount_smallest_units > 0),
  artist_wallet text not null,
  signature text not null unique,
  wallet_mode text not null check (wallet_mode in ('external_anchor', 'pollar_embedded_spl')),
  created_at timestamptz not null default now()
);

create table if not exists public.series (
  id text primary key,
  artist_user_id uuid not null references public.profiles(id) on delete restrict,
  track_id text not null references public.tracks(id) on delete restrict,
  title text not null,
  benefit_summary text not null,
  cap integer not null check (cap > 0),
  issued integer not null default 0 check (issued >= 0 and issued <= cap),
  primary_price_smallest_units numeric not null check (primary_price_smallest_units > 0),
  expiry timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'CLOSED')),
  deliverable_url text not null,
  pda text,
  created_at timestamptz not null default now()
);

create table if not exists public.passes (
  id text primary key,
  series_id text not null references public.series(id) on delete restrict,
  track_id text not null references public.tracks(id) on delete restrict,
  serial integer not null,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  owner_wallet text not null,
  status text not null check (status in ('OFFERED', 'OWNED', 'LISTED', 'REDEEMED', 'EXPIRED')),
  nonce integer not null default 0,
  listing_price_smallest_units numeric,
  listing_expiry timestamptz,
  unique (series_id, serial)
);

alter table public.support_receipts enable row level security;
alter table public.series enable row level security;
alter table public.passes enable row level security;
