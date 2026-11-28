\set ON_ERROR_STOP on
begin;
do $$
declare
 owner_id uuid;
 reviewer_id uuid;
 guest_id uuid;
 buyer_id uuid;
 tid uuid := gen_random_uuid();
 inquiry_id uuid := gen_random_uuid();
 declaration jsonb := jsonb_build_object('validUntil', (now() + interval '1 day')::text, 'evidenceDocument','private fixture');
 input jsonb;
begin
 select user_id into owner_id from public.provision_encore_identity('email', gen_random_uuid()::text, 'Owner fixture', null);
 select user_id into reviewer_id from public.provision_encore_identity('email', gen_random_uuid()::text, 'Reviewer fixture', null);
 select user_id into guest_id from public.provision_encore_identity('email', gen_random_uuid()::text, 'Other reviewer fixture', null);
 select user_id into buyer_id from public.provision_encore_identity('email', gen_random_uuid()::text, 'Buyer fixture', null);
 perform public.complete_encore_onboarding(owner_id,'Owner fixture',null,'artist','{}','{}');
 insert into public.user_roles(user_id,role) values (reviewer_id,'reviewer'), (guest_id,'reviewer'), (owner_id,'admin');
 insert into public.review_assignments(channel_id,reviewer_user_id)
 select id,reviewer_id from public.artist_channels where owner_user_id=owner_id;
 perform public.encore_create_release(jsonb_build_object('id',tid,'artistId',owner_id,'genre','Ambient','title','Fixture track',
   'status','draft','manifest',jsonb_build_object('trackId',tid,'version',1,'originCategory','HUMAN_CREATED'),
   'audioHash',repeat('b',64),'manifestHash',repeat('c',64)));
 perform public.encore_rights_action(owner_id,jsonb_build_object('action','submit','trackId',tid,'version',1,'declaration',declaration));
 if public.encore_can_review_rights(owner_id,tid) or public.encore_can_review_rights(guest_id,tid)
    or (select count(*) from public.encore_rights_review_queue(reviewer_id) where track_id=tid) <> 1
    or exists (select 1 from public.encore_rights_review_queue(guest_id) where track_id=tid) then
   raise exception 'Rights scope is incorrect';
 end if;
 input := jsonb_build_object('action','review','trackId',tid,'version',1,'revision',1,'decision','approved','reason','fixture documents checked');
 begin
   perform public.encore_rights_action(guest_id,input,'{"preview":true,"licenseUses":["film"],"externalUrl":null}');
   raise exception 'Unassigned review passed' using errcode='P0042';
 exception when raise_exception then null;
 end;
 perform public.encore_rights_action(reviewer_id,input,'{"preview":true,"licenseUses":["film"],"externalUrl":null}');
 perform public.encore_transition_release(tid,'draft','submitted',owner_id);
 perform public.encore_transition_release(tid,'submitted','approved',reviewer_id);
 perform public.encore_publish_release(tid,repeat('c',64),'test-receipt',owner_id);
 input := jsonb_build_object('action','request','trackId',tid,'version',1,'requestId',inquiry_id,'use','film','territory','EU','termMonths',12,'details','Private test scope');
 begin
   perform public.encore_rights_action(buyer_id,input || '{"use":"social"}');
   raise exception 'Unsupported scope passed' using errcode='P0042';
 exception when raise_exception then null;
 end;
 perform public.encore_rights_action(buyer_id,input);
 perform public.encore_rights_action(buyer_id,input);
 if (select count(*) from public.catalog_license_inquiries where track_id=tid) <> 1 then raise exception 'Duplicate inquiry'; end if;
 perform public.encore_rights_action(owner_id,jsonb_build_object('action','respond','requestId',inquiry_id,'decision','accepted_for_discussion','note','Fixture discussion'));
 perform public.encore_rights_action(owner_id,jsonb_build_object('action','withdraw','trackId',tid,'version',1,'revision',1));
 if (select status from public.catalog_license_inquiries where id=inquiry_id) <> 'closed' then raise exception 'Withdrawal left an active inquiry'; end if;
 if has_table_privilege('anon','public.catalog_rights','select') or
   has_table_privilege('authenticated','public.catalog_license_inquiries','select') or
   has_function_privilege('authenticated','public.encore_rights_action(uuid,jsonb,jsonb)','execute') then
   raise exception 'Private rights grants are too broad';
 end if;
end $$;
rollback;
