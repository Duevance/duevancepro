-- Atomic idempotency helpers for payment webhooks. Callable by the service role only.
create function public.claim_webhook_event(p_provider text, p_event_id text) returns text
language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  insert into webhook_events (provider, event_id) values (p_provider, p_event_id)
    on conflict (provider, event_id) do nothing;
  if found then return 'claimed'; end if;
  select processing_status into cur from webhook_events where provider = p_provider and event_id = p_event_id for update;
  if cur = 'failed' then
    update webhook_events set processing_status = 'processing' where provider = p_provider and event_id = p_event_id;
    return 'claimed';
  end if;
  if cur = 'processing' then return 'in_flight'; end if;
  return 'duplicate';
end $$;

create function public.finish_webhook_event(p_provider text, p_event_id text, p_status text) returns void
language sql security definer set search_path = public as $$
  update webhook_events set processing_status = p_status, processed_at = now()
  where provider = p_provider and event_id = p_event_id;
$$;

revoke all on function public.claim_webhook_event(text, text) from public, anon, authenticated;
revoke all on function public.finish_webhook_event(text, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_webhook_event(text, text) to service_role;
    grant execute on function public.finish_webhook_event(text, text, text) to service_role;
  end if;
end $$;
