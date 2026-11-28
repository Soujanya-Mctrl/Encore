# Queue worker setup and verification

`202611280009_queue_runtime.sql` adds service-only RPCs for enqueue, claim, and finish. Keep `pgmq` off the Data API schema list. Call `public.encore_enqueue_job` from a domain RPC when the database write and enqueue belong in one transaction. The server-side `PgmqAdapter` uses the same function for standalone enqueue. Expo clients use Encore's API and never call queue RPCs directly.

The worker accepts a `POST` with `Authorization: Bearer <JOB_RUNNER_SECRET>`. It claims at most 20 deliveries per invocation, rotates through the enabled queues, and gives each claim a 60-second visibility and execution lease. Five attempts are allowed with 15, 30, 60, and 120 seconds between failures. Successful, dead-lettered, or currently leased keys cannot run twice. A worker that loses its lease cannot acknowledge the message. A handler may execute again after a crash, so any future external side effect must use the job's idempotency key and honor its abort signal.

`notifications.queue_check` with `{}` as its payload is the infrastructure smoke job. Settlement, provenance, licensing, opportunity, and notification handlers must be registered when their product workflows are implemented. Jobs with unavailable handlers or invalid payloads move to `dead_letter`, with the source payload preserved in the private PGMQ archive. Keep producer schedules disabled until their handlers are registered. The worker logs counts without including payloads or secrets.

## Local verification

Run the following against a disposable PostgreSQL database with PGMQ and the queue migrations applied. The SQL test rolls back all rows.

```sh
pnpm exec vitest run tests/queues
psql "$LOCAL_DATABASE_URL" -f supabase/tests/queue_runtime.sql
```

To exercise a running Edge worker, use a service-role SQL session to enqueue a fresh smoke-test key, then invoke the function with the configured worker secret. Confirm that the execution record is `completed` and the source queue contains no remaining copy of that message.

```sql
select public.encore_enqueue_job('notifications', 'notifications.queue_check', gen_random_uuid()::text, '{}'::jsonb);
```

## Hosted job scheduling

Set `JOB_RUNNER_SECRET` in the Edge Function environment, deploy `process-jobs`, and enable `pg_cron` and `pg_net` for the target Supabase project. Store the project's base URL under `encore_queue_project_url` in Supabase Vault and store the matching worker secret under `encore_queue_runner_secret`. Use this command to opt into a once-per-minute schedule in that environment.

```sql
select cron.schedule('encore-process-jobs', '* * * * *', $cron$
  select net.http_post(
    url := rtrim(project.decrypted_secret, '/') || '/functions/v1/process-jobs',
    headers := jsonb_build_object('Authorization', 'Bearer ' || worker.decrypted_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  from vault.decrypted_secrets as project, vault.decrypted_secrets as worker
  where project.name = 'encore_queue_project_url' and worker.name = 'encore_queue_runner_secret';
$cron$);
```
