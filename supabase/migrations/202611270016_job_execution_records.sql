-- Idempotency and execution audit records for PGMQ consumers
create table if not exists public.job_execution_records (
  idempotency_key text primary key,
  queue_name text not null,
  job_type text not null,
  status text not null check (status in ('processing', 'completed', 'dead_lettered')),
  attempts integer not null default 1,
  last_error text,
  processed_at timestamptz not null default now()
);

alter table public.job_execution_records enable row level security;
