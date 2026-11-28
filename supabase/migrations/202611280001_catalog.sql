-- Phase 2: backend-only write ownership, private media and immutable passport history.
create table public.catalog_releases (
 id uuid primary key, artist_id uuid not null references public.profiles(id),
 status text not null check(status in ('draft','submitted','approved','anchor_pending','published','rejected')),
 paused boolean not null default false, origin text not null check(origin in ('HUMAN_CREATED','AI_ASSISTED','AI_GENERATED','UNKNOWN')),
 genre text not null, payload jsonb not null, created_at timestamptz not null default now(),
 search_document tsvector generated always as (to_tsvector('simple', coalesce(payload->>'title','')||' '||coalesce(payload->>'artistName','')||' '||genre||' '||coalesce(payload->>'description',''))) stored
);
create index catalog_search on public.catalog_releases using gin(search_document);
create index catalog_filters on public.catalog_releases(status,paused,origin,created_at desc,id);
create table public.catalog_passports (
 release_id uuid not null references public.catalog_releases(id),version integer not null check(version>0),
 manifest jsonb not null,manifest_hash text not null check(manifest_hash ~ '^[a-f0-9]{64}$'),audio_hash text not null,
 created_at timestamptz not null default now(),primary key(release_id,version)
);
create table public.catalog_audit(id bigint generated always as identity primary key,release_id uuid not null references public.catalog_releases(id),actor_id uuid not null references public.profiles(id),action text not null,created_at timestamptz not null default now());
alter table public.catalog_releases enable row level security;
alter table public.catalog_passports enable row level security;
alter table public.catalog_audit enable row level security;
revoke all on public.catalog_releases,public.catalog_passports,public.catalog_audit from anon,authenticated;
grant all on public.catalog_releases,public.catalog_passports,public.catalog_audit to service_role;
grant usage,select on sequence public.catalog_audit_id_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('encore-previews','encore-previews',false,20971520,array['audio/mpeg']) on conflict(id) do nothing;
create function public.encore_create_release(release jsonb) returns void language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from user_roles where user_id=(release->>'artistId')::uuid and role='artist') then raise exception 'artist required'; end if;
 insert into catalog_releases(id,artist_id,status,origin,genre,payload) values((release->>'id')::uuid,(release->>'artistId')::uuid,'draft',release->'manifest'->>'originCategory',release->>'genre',release);
 insert into catalog_passports(release_id,version,manifest,manifest_hash,audio_hash) values((release->>'id')::uuid,1,release->'manifest',release->>'manifestHash',release->>'audioHash');
end $$;
create function public.encore_transition_release(release_id uuid,expected_state text,next_state text,actor_id uuid) returns void language plpgsql set search_path=public as $$
declare r catalog_releases;
begin
 select * into strict r from catalog_releases where id=release_id for update;
 if r.status<>expected_state then raise exception 'stale state'; end if;
 if expected_state='draft' and next_state='submitted' then
  if r.artist_id<>actor_id then raise exception 'owner required';end if;
 elsif expected_state='submitted' and next_state in ('approved','rejected') then
  if r.artist_id=actor_id or not exists(select 1 from user_roles where user_id=actor_id and role in ('reviewer','admin')) then raise exception 'independent reviewer required';end if;
 else raise exception 'transition requires chain reconciliation';end if;
 update catalog_releases set status=next_state,payload=jsonb_set(payload,'{status}',to_jsonb(next_state)) where id=release_id;
 insert into catalog_audit(release_id,actor_id,action) values(release_id,actor_id,next_state);
end $$;
create function public.encore_append_passport(release_id uuid,owner_id uuid,expected_version integer,manifest jsonb,manifest_hash text) returns void language plpgsql set search_path=public as $$
declare r catalog_releases;
begin
 select * into strict r from catalog_releases where id=release_id for update;
 if r.artist_id<>owner_id or r.status not in ('draft','rejected') or (r.payload->'manifest'->>'version')::integer<>expected_version or (manifest->>'version')::integer<>expected_version+1 or manifest->>'previousHash'<>r.payload->>'manifestHash' then raise exception 'invalid append';end if;
 insert into catalog_passports(release_id,version,manifest,manifest_hash,audio_hash) values(release_id,expected_version+1,manifest,manifest_hash,r.payload->>'audioHash');
 update catalog_releases set status='draft',origin=manifest->>'originCategory',payload=payload||jsonb_build_object('manifest',manifest,'manifestHash',manifest_hash,'status','draft') where id=release_id;
end $$;
revoke all on function public.encore_create_release(jsonb),public.encore_transition_release(uuid,text,text,uuid),public.encore_append_passport(uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.encore_create_release(jsonb),public.encore_transition_release(uuid,text,text,uuid),public.encore_append_passport(uuid,uuid,integer,jsonb,text) to service_role;

create function public.encore_publish_release(release_id uuid,expected_hash text,signature text,owner_id uuid) returns void language plpgsql set search_path=public as $$
begin
 update catalog_releases set status='published',payload=payload||jsonb_build_object('status','published','anchorSignature',signature) where id=release_id and artist_id=owner_id and status in ('approved','anchor_pending') and payload->>'manifestHash'=expected_hash and paused=false;
 if not found then raise exception 'stale publication';end if;
 insert into catalog_audit(release_id,actor_id,action) values(release_id,owner_id,'published');
end $$;
revoke all on function public.encore_publish_release(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.encore_publish_release(uuid,text,text,uuid) to service_role;
notify pgrst,'reload schema';
