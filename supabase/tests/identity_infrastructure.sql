-- Run as the owner on a disposable database with Encore migrations applied.
-- All fixtures and permission probes are rolled back.
\set ON_ERROR_STOP on
begin;

set local role service_role;
do $$
declare
  identity public.auth_identities;
  repeated public.auth_identities;
  listener public.auth_identities;
  owner_channel_id uuid;
  wallet_address text := replace(encode(gen_random_bytes(20), 'hex'), '0', 'G');
begin
  select * into strict identity from public.provision_encore_identity(
    'email', 'infra-artist-' || gen_random_uuid() || '@example.com', 'Infra Artist', null
  );
  select * into strict repeated from public.provision_encore_identity(
    identity.provider, identity.provider_subject, 'Duplicate sign-in', null
  );
  if repeated.id <> identity.id or repeated.user_id <> identity.user_id then
    raise exception 'identity provisioning failed to reuse its original record';
  end if;
  select * into strict listener from public.provision_encore_identity(
    'email', 'infra-listener-' || gen_random_uuid() || '@example.com', 'Infra Listener', null
  );
  perform public.complete_encore_onboarding(identity.user_id, 'Infra Artist', null, 'artist', array['Ambient'], '{"humanCreated":true}'::jsonb);
  perform public.complete_encore_onboarding(identity.user_id, 'Infra Artist', null, 'artist', array['Jazz'], '{"humanCreated":true}'::jsonb);
  perform public.complete_encore_onboarding(listener.user_id, 'Infra Listener', null, 'listener', array[]::text[], '{}'::jsonb);
  select id into strict owner_channel_id from public.encore_studio_channel_for_user(identity.user_id);
  if (select count(*) from public.artist_channels where owner_user_id = identity.user_id) <> 1
    or not exists (select 1 from public.artist_channel_members where artist_channel_members.channel_id = owner_channel_id and user_id = identity.user_id and role = 'owner')
    or (select count(*) from public.user_roles where user_id = identity.user_id and role in ('listener', 'artist')) <> 2
    or not exists (select 1 from public.user_preferences where user_id = identity.user_id and preferred_genres = array['Jazz']) then
    raise exception 'artist onboarding failed to keep one channel, owner membership, both roles and saved preferences';
  end if;
  if exists (select 1 from public.encore_studio_channel_for_user(listener.user_id)) then
    raise exception 'listener onboarding unexpectedly granted Studio access';
  end if;
  begin
    perform public.complete_encore_onboarding(listener.user_id, 'Escalate', null, 'admin', array[]::text[], '{}'::jsonb);
    raise exception 'public onboarding accepted a privileged role';
  exception when invalid_parameter_value then
    null;
  end;
  perform public.bind_encore_verified_wallet(identity.user_id, wallet_address, 'external', true);
  begin
    perform public.bind_encore_verified_wallet(listener.user_id, wallet_address, 'external', true);
    raise exception 'wallet binding moved to a different account';
  exception when unique_violation then
    null;
  end;
  if not exists (select 1 from public.wallets where address = wallet_address and user_id = identity.user_id) then
    raise exception 'original wallet owner was lost';
  end if;
end $$;
reset role;

-- All sensitive identity and catalog relations require RLS. Service-only RPCs
-- must not be executable by Supabase browser roles even with guessed IDs.
do $$
declare
  actor text;
  relation text;
begin
  foreach relation in array array['profiles','auth_identities','wallets','user_roles','user_preferences','auth_challenges','auth_sessions','artist_channels','artist_channel_members','review_assignments','catalog_releases','catalog_passports','catalog_audit'] loop
    if not exists (select 1 from pg_class where oid = ('public.' || relation)::regclass and relrowsecurity) then
      raise exception 'RLS missing on %', relation;
    end if;
  end loop;
  foreach actor in array array['anon','authenticated'] loop
    if has_function_privilege(actor, 'public.provision_encore_identity(text,text,text,text)', 'EXECUTE')
      or has_function_privilege(actor, 'public.complete_encore_onboarding(uuid,text,text,text,text[],jsonb)', 'EXECUTE')
      or has_function_privilege(actor, 'public.bind_encore_verified_wallet(uuid,text,text,boolean)', 'EXECUTE') then
      raise exception '% can execute service-only onboarding RPCs', actor;
    end if;
  end loop;
  if not exists (select 1 from storage.buckets where id = 'encore-previews' and not public and file_size_limit = 20971520 and allowed_mime_types = array['audio/mpeg']) then
    raise exception 'private preview bucket or limits are missing';
  end if;
end $$;

set local role anon;
do $$
begin
  if has_table_privilege(current_user, 'public.profiles', 'SELECT') then
    if exists (select 1 from public.profiles) then
      raise exception 'anonymous role can read private profiles';
    end if;
  end if;
  begin
    insert into public.profiles (display_name) values ('Anonymous fixture');
    raise exception 'anonymous role can create private profiles';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

rollback;
select 'Identity, ownership, wallet isolation, private media configuration and API permissions passed' as result;
