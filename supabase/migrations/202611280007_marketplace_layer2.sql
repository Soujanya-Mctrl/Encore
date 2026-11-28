-- Layer 2 (Devnet/Demo Scope): Campaign Escrow, Spot Shares, Royalty Cycles, Opinion Market & Chain Indexer

create table if not exists public.campaigns (
  id text primary key,
  track_id text not null references public.tracks(id) on delete restrict,
  artist_user_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  goal_smallest_units numeric not null check (goal_smallest_units > 0),
  raised_smallest_units numeric not null default 0 check (raised_smallest_units >= 0),
  share_supply integer not null check (share_supply > 0),
  deadline timestamptz not null,
  use_of_funds text not null,
  rights_scope text not null,
  status text not null default 'FUNDING' check (status in ('FUNDING', 'FUNDED', 'FAILED')),
  vault_address text not null
);

create table if not exists public.campaign_pledges (
  campaign_id text not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount_smallest_units numeric not null check (amount_smallest_units > 0),
  refund_claimed boolean not null default false,
  primary key (campaign_id, user_id)
);

create table if not exists public.spot_listings (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  remaining_units integer not null check (remaining_units >= 0),
  unit_price_smallest_units numeric not null check (unit_price_smallest_units > 0),
  active boolean not null default true
);

create table if not exists public.distribution_cycles (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  period_label text not null,
  verified_revenue_smallest_units numeric not null check (verified_revenue_smallest_units >= 0),
  claimed_smallest_units numeric not null default 0,
  total_supply_snapshot integer not null check (total_supply_snapshot > 0),
  record_date timestamptz not null
);

create table if not exists public.distribution_claims (
  cycle_id text not null references public.distribution_cycles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  payout_smallest_units numeric not null check (payout_smallest_units > 0),
  claimed_at timestamptz not null default now(),
  primary key (cycle_id, user_id)
);

create table if not exists public.opinion_markets (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  question text not null,
  trading_cutoff timestamptz not null,
  campaign_deadline timestamptz not null,
  vault_address text not null,
  yes_pool_pairs integer not null default 0,
  no_pool_pairs integer not null default 0,
  resolved_outcome text not null default 'UNRESOLVED' check (resolved_outcome in ('UNRESOLVED', 'YES', 'NO')),
  check (trading_cutoff < campaign_deadline)
);

create table if not exists public.chain_events (
  signature text not null,
  event_index integer not null,
  slot bigint not null,
  event_type text not null,
  payload jsonb not null,
  finality text not null check (finality in ('confirmed', 'finalized')),
  created_at timestamptz not null default now(),
  primary key (signature, event_index)
);

alter table public.campaigns enable row level security;
alter table public.campaign_pledges enable row level security;
alter table public.spot_listings enable row level security;
alter table public.distribution_cycles enable row level security;
alter table public.distribution_claims enable row level security;
alter table public.opinion_markets enable row level security;
alter table public.chain_events enable row level security;
