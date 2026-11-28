\set ON_ERROR_STOP on
begin;
set local role service_role;
do $$
declare
 owner_id uuid;
 stranger_id uuid;
 track_id uuid := gen_random_uuid();
 manifest jsonb;
begin
 select user_id into owner_id from public.provision_encore_identity('email', gen_random_uuid()::text, 'Studio owner', null);
 select user_id into stranger_id from public.provision_encore_identity('email', gen_random_uuid()::text, 'Other owner', null);
 perform public.complete_encore_onboarding(owner_id,'Studio owner',null,'artist','{}','{}');
 perform public.complete_encore_onboarding(stranger_id,'Other owner',null,'artist','{}','{}');
 manifest := jsonb_build_object('trackId',track_id,'version',1,'originCategory','HUMAN_CREATED');
 perform public.encore_create_release(jsonb_build_object('id',track_id,'artistId',owner_id,'genre','Ambient',
   'status','draft','manifest',manifest,'audioHash',repeat('b',64),'manifestHash',repeat('c',64)));
 manifest := manifest || jsonb_build_object('version',2,'previousHash',repeat('c',64));
 begin
  perform public.encore_edit_studio_release(track_id,stranger_id,1,manifest,repeat('d',64),
    '{"title":"Forbidden","artistName":"Other","genre":"Ambient","description":""}');
  raise exception 'Cross-owner edit succeeded' using errcode = 'P0042';
 exception when raise_exception then null;
 end;
 perform public.encore_edit_studio_release(track_id,owner_id,1,manifest,repeat('d',64),
   '{"title":"Edited","artistName":"Studio owner","genre":"Electronic","description":""}');
 if not exists(select 1 from public.catalog_releases where id=track_id and genre='Electronic'
   and payload->>'title'='Edited' and payload->>'manifestHash'=repeat('d',64)) then
  raise exception 'Metadata and Passport were not saved together';
 end if;
 begin
  perform public.encore_submit_studio_release(track_id,owner_id,1);
  raise exception 'Stale submit succeeded' using errcode = 'P0042';
 exception when raise_exception then null;
 end;
 perform public.encore_submit_studio_release(track_id,owner_id,2);
 if (select status from public.catalog_releases where id=track_id) <> 'submitted' then
  raise exception 'Current revision was not submitted';
 end if;
 insert into public.user_roles (user_id,role) values (stranger_id,'reviewer');
 perform public.encore_transition_release(track_id,'submitted','approved',stranger_id);
 -- Use a synthetic finalized-receipt fixture for the database publication test.
 perform public.encore_publish_release(track_id,repeat('d',64),'test-receipt',owner_id);
 perform public.encore_delist_studio_release(track_id,owner_id,2);
 perform public.encore_delist_studio_release(track_id,owner_id,2);
 if exists(select 1 from public.catalog_releases where id=track_id and not paused) then
  raise exception 'Delisted publication is still active';
 end if;
 if (select count(*) from public.catalog_audit where release_id=track_id and action='delisted') <> 1 then
  raise exception 'Delist retry duplicated the audit record';
 end if;
 if has_function_privilege('anon','public.encore_edit_studio_release(uuid,uuid,integer,jsonb,text,jsonb)','execute') then
  raise exception 'Anonymous Studio write is executable';
 end if;
end $$;
rollback;
