-- Duevance schema. Run with `supabase db push` or paste into the SQL editor.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '' check (char_length(business_name) <= 120),
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  billing_country text check (billing_country ~ '^[A-Z]{2}$'),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 200),
  customer_email text check (customer_email is null or customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 32),
  invoice_no text not null check (char_length(btrim(invoice_no)) between 1 and 80),
  invoice_key text generated always as (lower(btrim(invoice_no))) stored,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  issue_date date,
  due_date date not null,
  status text not null default 'open' check (status in ('open','paid')),
  paid_at timestamptz,
  archived_at timestamptz,
  invoice_url text check (invoice_url is null or invoice_url ~* '^https?://'),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_paid_consistency check ((status = 'paid') = (paid_at is not null)),
  unique (user_id, invoice_key)
);
create index invoices_user_due_idx on public.invoices (user_id, due_date) where archived_at is null and status = 'open';
create index invoices_user_updated_idx on public.invoices (user_id, updated_at desc);

create table public.reminders_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  channel text check (channel in ('email','whatsapp','copy')),
  stage text check (stage in ('friendly','firm','final')),
  action_type text not null check (action_type in ('prepared','link_opened','copied','marked_sent','marked_paid','status_changed')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  -- sent_at may only exist on events the user explicitly confirmed as sent
  constraint reminders_sent_at_only_when_confirmed check (sent_at is null or action_type = 'marked_sent'),
  constraint reminders_marked_sent_has_time check (action_type <> 'marked_sent' or sent_at is not null)
);
create index reminders_user_created_idx on public.reminders_log (user_id, created_at desc);
create index reminders_invoice_idx on public.reminders_log (invoice_id, created_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('paypal','razorpay')),
  provider_subscription_id text not null,
  plan text not null default 'pro' check (plan in ('pro')),
  status text not null check (status in ('pending','active','past_due','cancelled','expired')),
  current_period_end timestamptz,
  cancel_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);
create index subscriptions_user_idx on public.subscriptions (user_id);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paypal','razorpay')),
  event_id text not null,
  processed_at timestamptz,
  processing_status text not null default 'processing' check (processing_status in ('processing','processed','failed','ignored')),
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- updated_at maintenance
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();

-- A profile row is created for every new auth user.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (user_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Pro access: active, or cancelled/past_due but still inside the paid period.
create function public.has_pro(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid and s.plan = 'pro' and (
      s.status = 'active'
      or (s.status in ('cancelled','past_due') and s.current_period_end is not null and s.current_period_end > now())
    )
  );
$$;

-- Free plan: at most 10 active (open, not archived) invoices. Enforced here so no client or API path can bypass it.
create function public.enforce_free_plan_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare active_count int;
begin
  if new.status <> 'open' or new.archived_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'open' and old.archived_at is null then return new; end if; -- already counted
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  if public.has_pro(new.user_id) then return new; end if;
  select count(*) into active_count from public.invoices
    where user_id = new.user_id and status = 'open' and archived_at is null and id <> new.id;
  if active_count >= 10 then
    raise exception 'FREE_PLAN_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger invoices_free_limit before insert or update on public.invoices for each row execute function public.enforce_free_plan_limit();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.reminders_log enable row level security;
alter table public.subscriptions enable row level security;
alter table public.webhook_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy invoices_select on public.invoices for select to authenticated using (user_id = auth.uid());
create policy invoices_insert on public.invoices for insert to authenticated with check (user_id = auth.uid());
create policy invoices_update on public.invoices for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy invoices_delete on public.invoices for delete to authenticated using (user_id = auth.uid());

-- Activity history is append-only for users.
create policy reminders_select on public.reminders_log for select to authenticated using (user_id = auth.uid());
create policy reminders_insert on public.reminders_log for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid()));

-- Subscriptions are readable by their owner and written only by the server (service role bypasses RLS).
create policy subscriptions_select on public.subscriptions for select to authenticated using (user_id = auth.uid());
-- webhook_events: RLS on with no policies = no access except service role.

revoke all on public.webhook_events from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
revoke all on public.profiles, public.invoices, public.reminders_log from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert on public.reminders_log to authenticated;
revoke execute on function public.has_pro(uuid) from anon;
