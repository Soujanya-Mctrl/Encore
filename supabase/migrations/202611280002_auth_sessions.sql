create table public.auth_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index auth_sessions_user_idx on public.auth_sessions(user_id);
create index auth_sessions_expiry_idx on public.auth_sessions(expires_at);
alter table public.auth_sessions enable row level security;
revoke all on table public.auth_sessions from anon, authenticated;
grant select, insert, delete on table public.auth_sessions to service_role;
