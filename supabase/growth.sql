-- ============================================================
-- IronPact — Growth Features Migration
-- Run this in the Supabase SQL editor.
-- ============================================================

-- ── 1. Analytics events table ────────────────────────────────────────────────
-- Stores all client-side events for funnel analysis, retention cohorts, etc.

create table if not exists analytics_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete set null,
  session_id text,
  event      text not null,
  properties jsonb default '{}',
  created_at timestamptz default now()
);

-- Indexes for common queries (funnel by event, per-user history, time ranges)
create index if not exists analytics_events_event_idx      on analytics_events (event, created_at desc);
create index if not exists analytics_events_user_idx       on analytics_events (user_id, created_at desc);
create index if not exists analytics_events_created_at_idx on analytics_events (created_at desc);

-- RLS: users can insert their own events; service role can read all (for dashboards)
alter table analytics_events enable row level security;

drop policy if exists "analytics_events_insert" on analytics_events;
create policy "analytics_events_insert" on analytics_events
  for insert with check (auth.uid() = user_id or user_id is null);

drop policy if exists "analytics_events_read_own" on analytics_events;
create policy "analytics_events_read_own" on analytics_events
  for select using (auth.uid() = user_id);

-- ── 2. Referral columns on profiles ─────────────────────────────────────────
-- referred_by: the profile ID of the user who referred this user

alter table profiles
  add column if not exists referred_by uuid references profiles(id) on delete set null;

-- stripe_customer_id: used by the Stripe integration
alter table profiles
  add column if not exists stripe_customer_id text;

-- ── 3. Subscriptions table ───────────────────────────────────────────────────
-- Tracks active subscriptions (written by the stripe-webhook Edge Function).

create table if not exists subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references profiles(id) on delete cascade not null unique,
  plan                    text not null default 'free',
  status                  text not null default 'active',
  stripe_subscription_id  text,
  stripe_customer_id      text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table subscriptions enable row level security;

drop policy if exists "subscriptions_read_own" on subscriptions;
create policy "subscriptions_read_own" on subscriptions
  for select using (auth.uid() = user_id);

-- Service role (webhook) can write without being restricted by RLS.
-- The Edge Function uses the service role key.

-- ── 4. Useful view: growth funnel ────────────────────────────────────────────
-- Query this in your Supabase dashboard to see top-of-funnel conversion.

create or replace view growth_funnel as
select
  date_trunc('day', created_at) as day,
  event,
  count(*) as occurrences,
  count(distinct user_id) as unique_users
from analytics_events
group by 1, 2
order by 1 desc, 3 desc;

-- Example queries:
--   SELECT * FROM growth_funnel WHERE event = 'signup_completed' ORDER BY day DESC;
--   SELECT event, unique_users FROM growth_funnel WHERE day >= now() - interval '7 days' GROUP BY event, unique_users;
