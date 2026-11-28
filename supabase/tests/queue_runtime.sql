-- Run against an isolated database with migrations applied. All writes roll back.
\set ON_ERROR_STOP on
begin;

DO $$
declare
  message_id text;
  duplicate_id text;
  original_token uuid;
  claim jsonb;
  outcome text;
  i integer;
begin
  if exists (select 1 from pgmq.q_notifications) or exists (select 1 from pgmq.q_dead_letter) then
    raise exception 'Queue integration check requires empty disposable notifications and dead-letter queues';
  end if;

  if has_function_privilege('anon', 'public.encore_enqueue_job(text,text,text,jsonb,integer)', 'execute')
    or has_function_privilege('authenticated', 'public.encore_claim_job(text,integer)', 'execute')
    or has_function_privilege('anon', 'public.encore_finish_job(text,text,uuid,boolean,text)', 'execute')
    or not has_function_privilege('service_role', 'public.encore_claim_job(text,integer)', 'execute') then
    raise exception 'Queue RPC grants are incorrect';
  end if;

  -- Public RPC writes participate in a PostgreSQL transaction.
  begin
    perform public.encore_enqueue_job('notifications', 'notifications.queue_check', 'rollback-check', '{}');
    raise exception 'rollback marker' using errcode = 'P0090';
  exception when sqlstate 'P0090' then null;
  end;
  if public.encore_claim_job('notifications', 60)->>'state' <> 'empty' then
    raise exception 'Rolled-back enqueue delivered a message';
  end if;

  set local role service_role;
  message_id := public.encore_enqueue_job('notifications', 'notifications.queue_check', 'delivery-check', '{}');
  duplicate_id := public.encore_enqueue_job('notifications', 'notifications.queue_check', 'delivery-check', '{}');
  claim := public.encore_claim_job('notifications', 60);
  original_token := (claim->>'token')::uuid;
  if claim->>'state' <> 'claimed' or (claim->>'attempt')::integer <> 1 then
    raise exception 'Fresh PGMQ delivery was not claimed';
  end if;
  if public.encore_claim_job('notifications', 60)->>'state' <> 'deferred' then
    raise exception 'Active execution did not exclude a duplicate delivery';
  end if;
  if public.encore_finish_job('notifications', 'delivery-check', gen_random_uuid(), true) <> 'lease_lost' then
    raise exception 'Foreign lease token acknowledged a delivery';
  end if;
  outcome := public.encore_finish_job('notifications', 'delivery-check', original_token, true);
  reset role;
  if outcome <> 'completed' or exists (select 1 from pgmq.q_notifications q where q.msg_id = message_id::bigint) then
    raise exception 'Successful delivery was not atomically acknowledged';
  end if;
  perform pgmq.set_vt('notifications', duplicate_id::bigint, 0);
  if public.encore_claim_job('notifications', 60)->>'state' <> 'duplicate' then
    raise exception 'Completed execution was not deduplicated';
  end if;

  -- Recover an abandoned lease using PGMQ's actual visibility expiration.
  message_id := public.encore_enqueue_job('notifications', 'notifications.queue_check', 'visibility-check', '{}');
  claim := public.encore_claim_job('notifications', 1);
  original_token := (claim->>'token')::uuid;
  if public.encore_claim_job('notifications', 1)->>'state' <> 'empty' then
    raise exception 'Leased source message unexpectedly visible';
  end if;
  perform pg_sleep(1.1);
  claim := public.encore_claim_job('notifications', 60);
  if claim->>'state' <> 'claimed' or (claim->>'attempt')::integer <> 2 or (claim->>'token')::uuid = original_token then
    raise exception 'Abandoned lease did not redeliver with a new claim';
  end if;
  if public.encore_finish_job('notifications', 'visibility-check', original_token, true) <> 'lease_lost' then
    raise exception 'Expired lease overwrote its successor';
  end if;
  perform public.encore_finish_job('notifications', 'visibility-check', (claim->>'token')::uuid, true);

  message_id := public.encore_enqueue_job('notifications', 'notifications.queue_check', 'retry-check', '{}');
  for i in 1..5 loop
    claim := public.encore_claim_job('notifications', 60);
    if claim->>'state' <> 'claimed' or (claim->>'attempt')::integer <> i then
      raise exception 'Unexpected execution attempt %: %', i, claim;
    end if;
    outcome := public.encore_finish_job('notifications', 'retry-check', (claim->>'token')::uuid, false, 'handler_failed');
    if i < 5 then
      if outcome <> 'retrying' or public.encore_claim_job('notifications', 60)->>'state' <> 'empty' then
        raise exception 'Failure was not delayed before retry';
      end if;
      if (select vt from pgmq.q_notifications q where q.msg_id = message_id::bigint)
           < clock_timestamp() + make_interval(secs => (15 * (1 << (i - 1))) - 2) then
        raise exception 'Retry deadline does not use exponential backoff';
      end if;
      -- Fast-forward the queue and execution deadline after asserting backoff.
      perform pgmq.set_vt('notifications', message_id::bigint, 0);
      update public.job_execution_records set lease_until = clock_timestamp() - interval '1 second'
        where queue_name = 'notifications' and idempotency_key = 'retry-check';
    end if;
  end loop;
  if outcome <> 'dead_lettered'
    or not exists (select 1 from pgmq.q_dead_letter q where q.message->>'sourceMessageId' = message_id and q.message->>'reason' = 'handler_failed')
    or not exists (select 1 from pgmq.a_notifications q where q.msg_id = message_id::bigint)
    or exists (select 1 from pgmq.q_notifications q where q.msg_id = message_id::bigint)
    or not exists (select 1 from public.job_execution_records e where e.idempotency_key = 'retry-check' and e.status = 'dead_lettered' and e.attempts = 5) then
    raise exception 'Exhausted source was not archived and sent to the DLQ';
  end if;

  -- A second producer cannot use the same key to overwrite a different payload.
  message_id := public.encore_enqueue_job('notifications', 'notifications.queue_check', 'delivery-check', '{"changed":true}');
  claim := public.encore_claim_job('notifications', 60);
  if claim->>'state' <> 'dead_lettered'
    or not exists (select 1 from pgmq.q_dead_letter q where q.message->>'sourceMessageId' = message_id and q.message->>'reason' = 'idempotency_conflict') then
    raise exception 'Conflicting idempotency key was not routed to the DLQ';
  end if;

  raise notice 'Queue runtime checks passed: service grants, rollback, delivery, active leases, dedupe, retry, abandoned lease recovery and dead letters';
end;
$$;

rollback;
