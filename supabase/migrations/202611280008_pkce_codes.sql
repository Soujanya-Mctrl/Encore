create table public.auth_pkce_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_session_id uuid not null references public.auth_sessions(id) on delete cascade,
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  redirect_uri text not null check (length(redirect_uri) between 1 and 512),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index auth_pkce_codes_source_idx on public.auth_pkce_codes(source_session_id);
create index auth_pkce_codes_user_idx on public.auth_pkce_codes(user_id);
create index auth_pkce_codes_expiry_idx on public.auth_pkce_codes(expires_at);
alter table public.auth_pkce_codes enable row level security;
revoke all on table public.auth_pkce_codes from public, anon, authenticated;
grant select, insert, delete on table public.auth_pkce_codes to service_role;
