-- Reuse the existing row-locked Passport append and keep metadata changes in the same transaction.
create function public.encore_edit_studio_release(
  release_id uuid, owner_id uuid, expected_version integer, manifest jsonb, manifest_hash text, metadata jsonb
) returns void language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.artist_channels c
    join public.artist_channel_members m on m.channel_id = c.id and m.user_id = c.owner_user_id
    join public.user_roles r on r.user_id = c.owner_user_id and r.role = 'artist'
    where c.owner_user_id = owner_id and m.role = 'owner') then
    raise exception 'studio owner required';
  end if;
  perform public.encore_append_passport(release_id, owner_id, expected_version, manifest, manifest_hash);
  if metadata is not null then
    update public.catalog_releases set genre = metadata->>'genre',
      payload = payload || jsonb_build_object('title', metadata->>'title', 'artistName', metadata->>'artistName',
        'genre', metadata->>'genre', 'description', metadata->>'description')
      where id = release_id and artist_id = owner_id;
  end if;
  insert into public.catalog_audit(release_id, actor_id, action)
    values (release_id, owner_id, case when manifest ? 'provenance' then 'provenance_evaluated' else 'edited' end);
end $$;

create function public.encore_delist_studio_release(release_id uuid, owner_id uuid, expected_version integer)
returns void language plpgsql set search_path = '' as $$
begin
  update public.catalog_releases c set paused = true, payload = jsonb_set(payload, '{paused}', 'true')
  where c.id = release_id and c.artist_id = owner_id and c.status = 'published'
    and (c.payload->'manifest'->>'version')::integer = expected_version and not c.paused
    and exists (select 1 from public.artist_channels channel
      join public.artist_channel_members member on member.channel_id = channel.id and member.user_id = channel.owner_user_id
      join public.user_roles r on r.user_id = channel.owner_user_id and r.role = 'artist'
      where channel.owner_user_id = owner_id and member.role = 'owner');
  if found then
    insert into public.catalog_audit(release_id, actor_id, action) values (release_id, owner_id, 'delisted');
  elsif not exists (select 1 from public.catalog_releases c where c.id = release_id and c.artist_id = owner_id
    and c.status = 'published' and c.paused and (c.payload->'manifest'->>'version')::integer = expected_version) then
    raise exception 'stale publication';
  end if;
end $$;

revoke all on function public.encore_edit_studio_release(uuid,uuid,integer,jsonb,text,jsonb),
  public.encore_delist_studio_release(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.encore_edit_studio_release(uuid,uuid,integer,jsonb,text,jsonb),
  public.encore_delist_studio_release(uuid,uuid,integer) to service_role;

create function public.encore_submit_studio_release(release_id uuid, owner_id uuid, expected_version integer)
returns void language plpgsql set search_path = '' as $$
begin
  perform 1 from public.catalog_releases c
    where c.id = release_id and c.artist_id = owner_id
      and (c.payload->'manifest'->>'version')::integer = expected_version
      and exists (select 1 from public.artist_channels channel
        join public.artist_channel_members member on member.channel_id = channel.id and member.user_id = channel.owner_user_id
        join public.user_roles r on r.user_id = channel.owner_user_id and r.role = 'artist'
        where channel.owner_user_id = owner_id and member.role = 'owner')
    for update;
  if not found then raise exception 'stale revision'; end if;
  perform public.encore_transition_release(release_id, 'draft', 'submitted', owner_id);
end $$;
revoke all on function public.encore_submit_studio_release(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.encore_submit_studio_release(uuid,uuid,integer) to service_role;
notify pgrst,'reload schema';
