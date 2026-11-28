create table public.catalog_rights (
  track_id uuid not null,
  passport_version integer not null,
  revision integer not null default 1,
  declaration jsonb not null,
  capabilities jsonb not null default '{"preview":false,"licenseUses":[],"externalUrl":null}',
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  review_reason text,
  updated_at timestamptz not null default now(),
  primary key (track_id, passport_version),
  foreign key (track_id, passport_version) references public.catalog_passports(release_id, version)
);
create table public.catalog_license_inquiries (
  id uuid primary key,
  track_id uuid not null,
  passport_version integer not null,
  requester uuid not null references public.profiles(id),
  scope jsonb not null,
  status text not null default 'pending' check (status in ('pending','accepted_for_discussion','declined','closed')),
  response text,
  created_at timestamptz not null default now(),
  foreign key (track_id, passport_version) references public.catalog_rights(track_id,passport_version)
);
create index catalog_license_inquiry_requester on public.catalog_license_inquiries(requester,created_at desc);
create index catalog_license_inquiry_track on public.catalog_license_inquiries(track_id,created_at desc);
create table public.catalog_rights_audit (
  id bigint generated always as identity primary key,
  track_id uuid not null references public.catalog_releases(id),
  passport_version integer not null,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  detail jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.catalog_rights enable row level security;
alter table public.catalog_license_inquiries enable row level security;
alter table public.catalog_rights_audit enable row level security;
revoke all on public.catalog_rights, public.catalog_license_inquiries, public.catalog_rights_audit from public, anon, authenticated;
grant select on public.catalog_rights, public.catalog_license_inquiries to service_role;

create function public.encore_can_review_rights(actor uuid, target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.catalog_releases track
    join public.user_roles role on role.user_id = actor
    where track.id = target and track.artist_id <> actor and (
      role.role = 'admin' or (role.role = 'reviewer' and exists (
        select 1 from public.artist_channels channel
        join public.review_assignments assignment on assignment.channel_id = channel.id
        where channel.owner_user_id = track.artist_id and assignment.reviewer_user_id = actor
          and not exists (select 1 from public.artist_channel_members member
            where member.channel_id = channel.id and member.user_id = actor)
      ))
    )
  );
$$;
create function public.encore_rights_review_queue(actor uuid) returns setof public.catalog_rights
language sql stable security definer set search_path = '' as $$
  select rights.* from public.catalog_rights rights join public.catalog_releases track on track.id = rights.track_id
  where rights.status = 'pending' and rights.passport_version = (track.payload->'manifest'->>'version')::integer
    and public.encore_can_review_rights(actor, rights.track_id) order by rights.updated_at limit 100;
$$;
revoke all on function public.encore_can_review_rights(uuid,uuid), public.encore_rights_review_queue(uuid) from public, anon, authenticated;
grant execute on function public.encore_can_review_rights(uuid,uuid), public.encore_rights_review_queue(uuid) to service_role;

create function public.encore_rights_action(actor uuid, input jsonb, permissions jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  op text := input->>'action';
  tid uuid := (input->>'trackId')::uuid;
  version integer := (input->>'version')::integer;
  inquiry_id uuid := (input->>'requestId')::uuid;
  release public.catalog_releases;
  rights public.catalog_rights;
  inquiry public.catalog_license_inquiries;
  request_scope jsonb;
begin
  if op = 'respond' then
    select * into strict inquiry from public.catalog_license_inquiries where id = inquiry_id;
    tid := inquiry.track_id;
    version := inquiry.passport_version;
  end if;
  select * into strict release from public.catalog_releases where id = tid for update;
  if (release.payload->'manifest'->>'version')::integer <> version then raise exception 'stale passport'; end if;
  select * into rights from public.catalog_rights where track_id = tid and passport_version = version for update;
  if op = 'submit' then
    if release.artist_id <> actor or rights.status = 'approved' or not exists (
      select 1 from public.user_roles where user_id = actor and role = 'artist'
    ) then raise exception 'rights declaration not allowed'; end if;
    if rights.status = 'pending' and rights.declaration = input->'declaration' then return; end if;
    insert into public.catalog_rights(track_id,passport_version,declaration) values (tid,version,input->'declaration')
    on conflict (track_id,passport_version) do update
      set revision = catalog_rights.revision + 1, declaration = excluded.declaration, status = 'pending',
        capabilities = excluded.capabilities, review_reason = null, updated_at = now();
  elsif op in ('review','withdraw') then
    if rights.revision is distinct from (input->>'revision')::integer then raise exception 'stale declaration'; end if;
    if op = 'review' then
      if rights.status <> 'pending' or not public.encore_can_review_rights(actor, tid) then
        raise exception 'independent review required';
      end if;
      update public.catalog_rights set status = input->>'decision',
        capabilities = case when input->>'decision' = 'approved' then permissions else capabilities end,
        review_reason = input->>'reason', updated_at = now()
        where track_id = tid and passport_version = version;
    else
      if release.artist_id <> actor then raise exception 'rights holder required'; end if;
      if rights.status = 'withdrawn' then return; end if;
      update public.catalog_rights set status = 'withdrawn', updated_at = now()
        where track_id = tid and passport_version = version;
      update public.catalog_license_inquiries set status = 'closed'
        where track_id = tid and passport_version = version and status in ('pending','accepted_for_discussion');
    end if;
  elsif op in ('request','respond') then
    if release.status <> 'published' or release.paused or rights.status is distinct from 'approved'
      or (rights.declaration->>'validUntil')::timestamptz <= now() then raise exception 'rights clearance unavailable'; end if;
    if op = 'request' then
      if release.artist_id = actor or not (rights.capabilities->'licenseUses' ? (input->>'use')) then
        raise exception 'requested use unavailable';
      end if;
      request_scope := input - array['action','trackId','version','requestId'];
      insert into public.catalog_license_inquiries(id,track_id,passport_version,requester,scope)
        values (inquiry_id,tid,version,actor,request_scope) on conflict (id) do nothing;
      if not found then
        if exists (select 1 from public.catalog_license_inquiries where id = inquiry_id
          and track_id = tid and passport_version = version and requester = actor and catalog_license_inquiries.scope = request_scope) then return; end if;
        raise exception 'request ID already used';
      end if;
    else
      if release.artist_id <> actor then raise exception 'rights holder required'; end if;
      if inquiry.status = input->>'decision' and inquiry.response = input->>'note' then return; end if;
      update public.catalog_license_inquiries set status = input->>'decision', response = input->>'note'
        where id = inquiry_id and status = 'pending';
      if not found then raise exception 'inquiry already decided'; end if;
    end if;
  else
    raise exception 'unsupported rights action';
  end if;
  insert into public.catalog_rights_audit(track_id,passport_version,actor_id,action,detail)
  values (tid,version,actor,op,input);
end $$;
revoke all on function public.encore_rights_action(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.encore_rights_action(uuid,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
