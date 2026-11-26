-- Restrict PGMQ schema access to service_role / Edge Function consumers only
revoke all on schema pgmq from public, anon, authenticated;
grant usage on schema pgmq to service_role;
