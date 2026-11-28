-- Governance (campaign reviews, milestones, dual-approval revenue cycles) & Spot Fills / Indexer Cursor (RLS enabled)

create table if not exists public.campaign_reviews (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.campaigns(id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED')),
  notes text not null default '',
  terms_hash text check (terms_hash is null or char_length(terms_hash) = 64),
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_milestones (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  sequence_index integer not null check (sequence_index >= 0),
  title text not null,
  release_amount_smallest_units numeric not null check (release_amount_smallest_units > 0),
  evidence_uri text,
  status text not null default 'PENDING' check (status in ('PENDING', 'SUBMITTED', 'APPROVED', 'RELEASED', 'REJECTED')),
  reviewer_user_id uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique (campaign_id, sequence_index)
);

create table if not exists public.distribution_approvals (
  cycle_id text primary key references public.distribution_cycles(id) on delete cascade,
  operator_user_id uuid not null references public.profiles(id) on delete restrict,
  approver_user_id uuid references public.profiles(id) on delete restrict,
  evidence_hash text not null check (char_length(evidence_hash) = 64),
  reconciled_at timestamptz not null default now(),
  approved_at timestamptz,
  funded_tx_sig text,
  status text not null default 'RECONCILED' check (status in ('RECONCILED', 'FUNDED_AND_OPEN')),
  check (approver_user_id is null or operator_user_id <> approver_user_id)
);

create table if not exists public.spot_fills (
  id uuid primary key default gen_random_uuid(),
  spot_listing_id text not null references public.spot_listings(id) on delete cascade,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  units integer not null check (units > 0),
  unit_price_smallest_units numeric not null check (unit_price_smallest_units > 0),
  tx_signature text not null unique,
  filled_at timestamptz not null default now()
);

create table if not exists public.chain_indexer_cursor (
  cluster text primary key,
  last_signature text,
  last_slot bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_spot_fills_campaign_filled_at on public.spot_fills (campaign_id, filled_at desc);
create index if not exists idx_campaign_milestones_campaign on public.campaign_milestones (campaign_id, sequence_index);

alter table public.campaign_reviews enable row level security;
alter table public.campaign_milestones enable row level security;
alter table public.distribution_approvals enable row level security;
alter table public.spot_fills enable row level security;
alter table public.chain_indexer_cursor enable row level security;
