-- Service-only queue surface. Keep pgmq off the PostgREST exposed schemas.
alter table public.job_execution_records
  drop constraint if exists job_execution_records_pkey,
  drop constraint if exists job_execution_records_status_check,
  add primary key (queue_name, idempotency_key),
  add constraint job_execution_records_status_check
    check (status in ('processing', 'retrying', 'completed', 'dead_lettered')),
  add column message_id bigint,
  add column lease_token uuid,
  add column lease_until timestamptz,
  add column payload_digest text;

revoke all on public.job_execution_records from public, anon, authenticated;

create function public.encore_enqueue_job(
  job_queue text, job_type text, job_key text, job_payload jsonb, job_delay integer default 0
) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if job_queue is null or job_queue not in ('provenance', 'settlement', 'licensing', 'opportunities', 'notifications')
    or job_type is null or length(job_type) > 120 or not starts_with(job_type, job_queue || '.')
    or coalesce(length(btrim(job_key)), 0) not between 1 and 160
    or jsonb_typeof(job_payload) is distinct from 'object' or octet_length(job_payload::text) > 32768
    or job_delay is null or job_delay not between 0 and 86400 then
    raise exception 'Invalid job envelope' using errcode = '22023';
  end if;

  -- Invoking this function within a domain RPC participates in its transaction.
  return (select sent::text from pgmq.send(job_queue, jsonb_build_object(
    'queue', job_queue, 'jobType', job_type, 'idempotencyKey', job_key, 'payload', job_payload), job_delay) as sent);
end;
$$;

create function public.encore_claim_job(job_queue text, lease_seconds integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  queued record;
  execution public.job_execution_records%rowtype;
  payload jsonb;
  key text;
  kind text;
  digest text;
  token uuid;
  now_at timestamptz;
  delay integer;
begin
  if job_queue is null or job_queue not in ('provenance', 'settlement', 'licensing', 'opportunities', 'notifications')
    or lease_seconds is null or lease_seconds not between 1 and 120 then
    raise exception 'Invalid queue claim' using errcode = '22023';
  end if;

  select msg_id, message, vt into queued from pgmq.read(job_queue, lease_seconds, 1);
  if not found then return jsonb_build_object('state', 'empty'); end if;

  key := queued.message ->> 'idempotencyKey';
  kind := queued.message ->> 'jobType';
  payload := queued.message -> 'payload';
  if jsonb_typeof(queued.message -> 'idempotencyKey') is distinct from 'string'
    or coalesce(length(btrim(key)), 0) not between 1 and 160
    or jsonb_typeof(queued.message -> 'jobType') is distinct from 'string'
    or kind is null or length(kind) > 120 or not starts_with(kind, job_queue || '.')
    or (queued.message ? 'queue' and queued.message ->> 'queue' is distinct from job_queue)
    or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text) > 32768 then
    perform pgmq.send('dead_letter', jsonb_build_object('sourceQueue', job_queue,
      'sourceMessageId', queued.msg_id::text, 'reason', 'invalid_envelope'));
    perform pgmq.archive(job_queue, queued.msg_id);
    return jsonb_build_object('state', 'dead_lettered');
  end if;

  digest := encode(sha256(convert_to(payload::text, 'UTF8')), 'hex');
  insert into public.job_execution_records (idempotency_key, queue_name, job_type, status, attempts, payload_digest)
    values (key, job_queue, kind, 'retrying', 0, digest) on conflict do nothing;

  select * into strict execution from public.job_execution_records
    where queue_name = job_queue and idempotency_key = key for update;
  if execution.job_type <> kind or (execution.payload_digest is not null and execution.payload_digest <> digest) then
    perform pgmq.send('dead_letter', jsonb_build_object('sourceQueue', job_queue,
      'sourceMessageId', queued.msg_id::text, 'reason', 'idempotency_conflict'));
    perform pgmq.archive(job_queue, queued.msg_id);
    return jsonb_build_object('state', 'dead_lettered');
  end if;

  if execution.status in ('completed', 'dead_lettered') then
    perform pgmq.delete(job_queue, queued.msg_id);
    return jsonb_build_object('state', 'duplicate');
  end if;

  now_at := clock_timestamp();
  if execution.lease_until > now_at then
    delay := greatest(1, ceil(extract(epoch from execution.lease_until - now_at))::integer);
    perform pgmq.set_vt(job_queue, queued.msg_id, delay);
    return jsonb_build_object('state', 'deferred');
  end if;

  if execution.attempts >= 5 then
    perform pgmq.send('dead_letter', jsonb_build_object('sourceQueue', job_queue,
      'sourceMessageId', queued.msg_id::text, 'reason', 'lease_expired', 'attempts', execution.attempts,
      'jobType', kind, 'idempotencyKey', key));
    perform pgmq.archive(job_queue, queued.msg_id);
    update public.job_execution_records set status = 'dead_lettered', last_error = 'lease_expired',
      lease_token = null, lease_until = null, processed_at = now_at
      where queue_name = job_queue and idempotency_key = key;
    return jsonb_build_object('state', 'dead_lettered');
  end if;

  -- A duplicate may be older than this delivery. Give the winner a fresh lease.
  perform pgmq.set_vt(job_queue, queued.msg_id, lease_seconds);
  token := gen_random_uuid();
  update public.job_execution_records set status = 'processing', attempts = execution.attempts + 1,
    payload_digest = digest, message_id = queued.msg_id, lease_token = token,
    lease_until = now_at + make_interval(secs => lease_seconds), processed_at = now_at
    where queue_name = job_queue and idempotency_key = key;

  return jsonb_build_object('state', 'claimed', 'key', key, 'jobType', kind, 'payload', payload,
    'token', token, 'attempt', execution.attempts + 1);
end;
$$;

create function public.encore_finish_job(
  job_queue text, job_key text, claim_token uuid, succeeded boolean, failure_reason text default null
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  execution public.job_execution_records%rowtype;
  reason text;
  delay integer;
begin
  select * into execution from public.job_execution_records
    where queue_name = job_queue and idempotency_key = job_key for update;
  if not found or execution.status <> 'processing' or execution.lease_token is null
    or execution.lease_token is distinct from claim_token or execution.lease_until <= clock_timestamp() then
    return 'lease_lost';
  end if;

  if succeeded is true then
    perform pgmq.delete(job_queue, execution.message_id);
    update public.job_execution_records set status = 'completed', last_error = null, lease_token = null,
      lease_until = null, processed_at = clock_timestamp()
      where queue_name = job_queue and idempotency_key = job_key;
    return 'completed';
  end if;

  reason := case when failure_reason in ('handler_unavailable', 'invalid_payload', 'handler_failed')
    then failure_reason else 'handler_failed' end;
  if execution.attempts >= 5 or reason in ('handler_unavailable', 'invalid_payload') then
    -- PGMQ archive keeps the source payload in the same transaction as DLQ routing.
    -- Keep the queue-specific message id for operator recovery without duplicating secrets.
    perform pgmq.send('dead_letter', jsonb_build_object('sourceQueue', job_queue,
      'sourceMessageId', execution.message_id::text, 'reason', reason, 'attempts', execution.attempts,
      'jobType', execution.job_type, 'idempotencyKey', job_key));
    perform pgmq.archive(job_queue, execution.message_id);
    update public.job_execution_records set status = 'dead_lettered', last_error = reason,
      lease_token = null, lease_until = null, processed_at = clock_timestamp()
      where queue_name = job_queue and idempotency_key = job_key;
    return 'dead_lettered';
  end if;

  delay := 15 * (1 << (execution.attempts - 1));
  perform pgmq.set_vt(job_queue, execution.message_id, delay);
  update public.job_execution_records set status = 'retrying', last_error = reason, lease_token = null,
    lease_until = clock_timestamp() + make_interval(secs => delay), processed_at = clock_timestamp()
    where queue_name = job_queue and idempotency_key = job_key;
  return 'retrying';
end;
$$;

revoke execute on function public.encore_enqueue_job(text, text, text, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.encore_claim_job(text, integer) from public, anon, authenticated;
revoke execute on function public.encore_finish_job(text, text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.encore_enqueue_job(text, text, text, jsonb, integer) to service_role;
grant execute on function public.encore_claim_job(text, integer) to service_role;
grant execute on function public.encore_finish_job(text, text, uuid, boolean, text) to service_role;
