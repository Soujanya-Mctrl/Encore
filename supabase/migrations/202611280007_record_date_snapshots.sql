-- Frozen record-date holder snapshots for distribution cycles (RLS enabled)

create table if not exists public.distribution_record_snapshots (
  cycle_id text not null references public.distribution_cycles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  units integer not null check (units > 0),
  snapshot_at timestamptz not null default now(),
  primary key (cycle_id, user_id)
);

alter table public.distribution_record_snapshots enable row level security;
