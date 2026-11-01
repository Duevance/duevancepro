-- Saved custom reminder templates (Pro only, enforced by RLS) and privacy-safe product events.
create table public.reminder_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('friendly','firm','final')),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stage)
);
create trigger reminder_templates_touch before update on public.reminder_templates for each row execute function public.touch_updated_at();
alter table public.reminder_templates enable row level security;
create policy templates_select on public.reminder_templates for select to authenticated using (user_id = auth.uid());
create policy templates_insert on public.reminder_templates for insert to authenticated with check (user_id = auth.uid() and public.has_pro(auth.uid()));
create policy templates_update on public.reminder_templates for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_pro(auth.uid()));
create policy templates_delete on public.reminder_templates for delete to authenticated using (user_id = auth.uid());
revoke all on public.reminder_templates from anon;
grant select, insert, update, delete on public.reminder_templates to authenticated;

-- Event names only. No invoice contents, customer details or free text are ever stored here.
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name in ('signup_completed','first_invoice_created','first_csv_import','first_reminder_action','invoice_marked_paid','free_limit_reached','checkout_initiated','subscription_activated','subscription_cancelled')),
  created_at timestamptz not null default now()
);
create index product_events_user_idx on public.product_events (user_id, name);
-- "first_*" and signup events can only be recorded once per user
create unique index product_events_once_idx on public.product_events (user_id, name) where name in ('signup_completed','first_invoice_created','first_csv_import','first_reminder_action');
alter table public.product_events enable row level security;
create policy events_select on public.product_events for select to authenticated using (user_id = auth.uid());
create policy events_insert on public.product_events for insert to authenticated with check (user_id = auth.uid());
revoke all on public.product_events from anon;
grant select, insert on public.product_events to authenticated;
