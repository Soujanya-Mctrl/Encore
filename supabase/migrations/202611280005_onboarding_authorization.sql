-- Onboarding and access: application actors are verified by the Encore server.
-- The Data API accepts these operations from service_role only.

alter table public.auth_challenges
  add column if not exists message_digest text check (message_digest ~ '^[0-9a-f]{64}$');

create table if not exists public.artist_channels (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.profiles(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.artist_channel_members (
  channel_id uuid not null references public.artist_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  primary key (channel_id, user_id)
);
create unique index if not exists artist_channel_members_one_owner_idx
  on public.artist_channel_members (channel_id) where role = 'owner';
create index if not exists artist_channel_members_user_idx
  on public.artist_channel_members (user_id, channel_id);

create table if not exists public.review_assignments (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.artist_channels(id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (channel_id, reviewer_user_id)
);
create index if not exists review_assignments_reviewer_idx
  on public.review_assignments (reviewer_user_id, created_at, id);

alter table public.artist_channels enable row level security;
alter table public.artist_channel_members enable row level security;
alter table public.review_assignments enable row level security;
revoke all on public.artist_channels, public.artist_channel_members, public.review_assignments
  from public, anon, authenticated, service_role;
grant select, insert on public.artist_channels, public.artist_channel_members to service_role;
grant select on public.review_assignments to service_role;

-- Backfill existing completed artist accounts using the same deterministic handle
-- as first-time onboarding. Do not grant roles to listeners or add editor invites.
insert into public.artist_channels (owner_user_id, handle, display_name)
select p.id, 'artist-' || p.id::text, p.display_name
from public.profiles p
join public.user_roles r on r.user_id = p.id and r.role = 'artist'
where p.onboarding_status = 'completed'
on conflict (owner_user_id) do nothing;

insert into public.artist_channel_members (channel_id, user_id, role)
select id, owner_user_id, 'owner'
from public.artist_channels
on conflict (channel_id, user_id) do nothing;

create or replace function public.provision_encore_identity(
  p_provider text, p_subject text, p_display_name text, p_avatar_url text
) returns setof public.auth_identities
language plpgsql security invoker set search_path = ''
as $$
declare
  v_identity public.auth_identities;
  v_user_id uuid;
begin
  -- Serialize the first sign-ins for one provider identity. Returning the
  -- existing identity keeps the operation safe to retry after a lost response.
  perform pg_advisory_xact_lock(hashtextextended('encore:identity:' || p_provider || ':' || p_subject, 0));
  select i.* into v_identity from public.auth_identities i
    where i.provider = p_provider and i.provider_subject = p_subject;
  if not found then
    insert into public.profiles (display_name, avatar_url)
      values (p_display_name, p_avatar_url) returning id into v_user_id;
    insert into public.user_roles (user_id, role) values (v_user_id, 'listener');
    insert into public.auth_identities (user_id, provider, provider_subject)
      values (v_user_id, p_provider, p_subject) returning * into v_identity;
  end if;
  return next v_identity;
end;
$$;

create or replace function public.complete_encore_onboarding(
  p_user_id uuid, p_display_name text, p_avatar_url text, p_journey text,
  p_preferred_genres text[], p_origin_preferences jsonb
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_channel_id uuid;
begin
  if p_journey is null or p_journey not in ('listener', 'artist') then
    raise exception 'Invalid public onboarding role' using errcode = '22023';
  end if;

  -- This UPDATE locks the profile for the rest of the transaction, including
  -- the associated role, preferences and optional channel writes.
  update public.profiles
  set display_name = p_display_name, avatar_url = p_avatar_url,
      onboarding_status = 'completed', updated_at = now()
  where id = p_user_id;
  if not found then
    raise exception 'Encore profile not found' using errcode = 'P0002';
  end if;

  insert into public.user_roles (user_id, role)
    values (p_user_id, 'listener'), (p_user_id, p_journey)
    on conflict do nothing;

  insert into public.user_preferences
    (user_id, preferred_genres, creative_origin_preferences, onboarding_completed_at)
  values (p_user_id, p_preferred_genres, p_origin_preferences, now())
  on conflict (user_id) do update set
    preferred_genres = excluded.preferred_genres,
    creative_origin_preferences = excluded.creative_origin_preferences,
    onboarding_completed_at = coalesce(public.user_preferences.onboarding_completed_at, excluded.onboarding_completed_at);

  if p_journey = 'artist' then
    insert into public.artist_channels (owner_user_id, handle, display_name)
      values (p_user_id, 'artist-' || p_user_id::text, p_display_name)
      on conflict (owner_user_id) do nothing;
    select id into strict v_channel_id from public.artist_channels where owner_user_id = p_user_id;
    insert into public.artist_channel_members (channel_id, user_id, role)
      values (v_channel_id, p_user_id, 'owner') on conflict do nothing;
  end if;
end;
$$;

create or replace function public.bind_encore_verified_wallet(
  p_user_id uuid, p_address text, p_wallet_type text, p_is_primary boolean
) returns setof public.wallets
language plpgsql security invoker set search_path = ''
as $$
begin
  return query
    insert into public.wallets as bound (user_id, chain, address, wallet_type, is_primary)
    values (p_user_id, 'solana', p_address, p_wallet_type, p_is_primary)
    on conflict (address) do update set
      wallet_type = excluded.wallet_type,
      is_primary = excluded.is_primary,
      verified_at = now()
    where bound.user_id = excluded.user_id
    returning bound.*;
  if not found then
    raise exception 'Wallet is already bound to another Encore account' using errcode = '23505';
  end if;
end;
$$;

create or replace function public.encore_studio_channel_for_user(p_user_id uuid)
returns table (id uuid, handle text, display_name text, role text)
language sql stable security invoker set search_path = ''
as $$
  select c.id, c.handle, c.display_name, m.role
  from public.artist_channel_members m
  join public.artist_channels c on c.id = m.channel_id
  where m.user_id = p_user_id
    and ((m.role = 'owner' and c.owner_user_id = p_user_id and exists (
      select 1 from public.user_roles r where r.user_id = p_user_id and r.role = 'artist'
    )) or (m.role = 'editor' and c.owner_user_id <> p_user_id))
  order by (m.role = 'owner') desc, c.created_at, c.id
  limit 1
$$;

create or replace function public.encore_review_assignments_for_user(p_user_id uuid)
returns table (id uuid, channel_id uuid, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select a.id, a.channel_id, a.created_at
  from public.review_assignments a
  join public.artist_channels c on c.id = a.channel_id
  where a.reviewer_user_id = p_user_id
    and c.owner_user_id <> p_user_id
    and exists (
      select 1 from public.user_roles r where r.user_id = p_user_id and r.role = 'reviewer'
    )
    and not exists (
      select 1 from public.artist_channel_members m
      where m.channel_id = a.channel_id and m.user_id = p_user_id
    )
  order by a.created_at desc, a.id
$$;

revoke execute on function
  public.provision_encore_identity(text, text, text, text),
  public.complete_encore_onboarding(uuid, text, text, text, text[], jsonb),
  public.bind_encore_verified_wallet(uuid, text, text, boolean),
  public.encore_studio_channel_for_user(uuid),
  public.encore_review_assignments_for_user(uuid)
from public, anon, authenticated;

grant execute on function
  public.provision_encore_identity(text, text, text, text),
  public.complete_encore_onboarding(uuid, text, text, text, text[], jsonb),
  public.bind_encore_verified_wallet(uuid, text, text, boolean),
  public.encore_studio_channel_for_user(uuid),
  public.encore_review_assignments_for_user(uuid)
to service_role;

