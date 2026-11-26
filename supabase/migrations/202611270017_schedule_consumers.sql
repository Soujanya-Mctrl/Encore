-- Schedule bounded PGMQ consumer execution via Supabase Cron (pg_cron + pg_net)
-- Configured with project URL & JOB_RUNNER_SECRET during H02-10 deployment.
create extension if not exists pg_cron;
