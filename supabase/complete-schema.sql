-- ============================================================
-- IronPact — Complete Authoritative Schema
-- ============================================================
-- Run this in the Supabase SQL editor for a FRESH deployment.
-- For existing deployments, run fix-friendships.sql instead
-- and apply only the sections that are missing.
--
-- Migration order (fresh setup):
--   1. This file (complete-schema.sql)
--   2. growth.sql           — analytics_events, subscriptions, referral columns
--   3. token-purchases.sql  — token_purchases table + increment_tokens RPC
--   4. ai-cache.sql         — ai_cache table for coaching response caching
--
-- Required Supabase secrets (Dashboard → Settings → Edge Functions → Secrets):
--   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
--   ANTHROPIC_API_KEY
--   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
--   STRIPE_PRICE_WEEKLY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_QUARTERLY, STRIPE_PRICE_YEARLY
--   STRIPE_PRICE_BUNDLE_STARTER, STRIPE_PRICE_BUNDLE_POWER, STRIPE_PRICE_BUNDLE_ELITE
--   STRIPE_PRICE_BUNDLE_CHAMPION, STRIPE_PRICE_BUNDLE_LEGENDARY
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- CORE: Profiles
-- ============================================================
create table if not exists profiles (
  id                        uuid references auth.users(id) on delete cascade primary key,
  display_name              text not null default 'Lifter',
  username                  text unique,
  email                     text,
  unit                      text not null default 'kg' check (unit in ('kg', 'lbs')),
  emoji                     text default '💪',
  token_balance             integer not null default 25,
  is_beta_user              boolean not null default false,
  is_premium                boolean not null default false,
  subscription_plan         text not null default 'free',
  stripe_customer_id        text,
  equipped_title            text,
  equipped_badge            text,
  equipped_theme            text,
  equipped_frame            text,
  daily_workout_count       integer not null default 0,
  last_workout_credited_at  timestamptz,
  weekly_tokens_earned      integer not null default 0,
  week_reset_at             timestamptz,
  login_streak              integer not null default 0,
  longest_login_streak      integer not null default 0,
  last_login_date           date,
  referred_by               uuid references profiles(id) on delete set null,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_read_own"        on profiles;
drop policy if exists "profiles_write_own"       on profiles;
drop policy if exists "profiles_insert_own"      on profiles;
drop policy if exists "profiles_read_friends"    on profiles;
drop policy if exists "profiles_read_by_username" on profiles;

create policy "profiles_read_own"        on profiles for select using (auth.uid() = id);
create policy "profiles_write_own"       on profiles for all    using (auth.uid() = id);
create policy "profiles_insert_own"      on profiles for insert with check (auth.uid() = id);
create policy "profiles_read_by_username" on profiles for select using (username is not null);
create policy "profiles_read_friends"    on profiles for select using (
  exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = id)
        or (f.addressee_id = auth.uid() and f.requester_id = id))
  )
);

-- ============================================================
-- EXERCISES: Catalog (shared + custom)
-- ============================================================
create table if not exists exercises (
  id                uuid default uuid_generate_v4() primary key,
  name              text not null,
  muscle_group      text,
  equipment         text,
  exercise_type     text default 'compound' check (exercise_type in ('compound','isolation','cardio','bodyweight')),
  exercise_modality text default 'reps'     check (exercise_modality in ('reps','duration','distance')),
  description       text default '',
  is_custom         boolean not null default false,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz default now()
);

create index if not exists exercises_muscle_idx on exercises(muscle_group);
create index if not exists exercises_custom_idx on exercises(created_by, is_custom);

alter table exercises enable row level security;

drop policy if exists "exercises_read_all" on exercises;
drop policy if exists "exercises_write_own" on exercises;
create policy "exercises_read_all"  on exercises for select using (is_custom = false or created_by = auth.uid());
create policy "exercises_write_own" on exercises for all    using (is_custom = true and created_by = auth.uid());
create policy "exercises_insert_own" on exercises for insert with check (auth.uid() = created_by);

-- ============================================================
-- WORKOUTS: Session logging
-- ============================================================
create table if not exists workouts (
  id               uuid default uuid_generate_v4() primary key,
  user_id          uuid references profiles(id) on delete cascade not null,
  name             text,
  started_at       timestamptz,
  completed_at     timestamptz,
  duration_seconds integer default 0,
  notes            text default '',
  is_ai_generated  boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists workouts_user_idx on workouts(user_id, started_at desc);

alter table workouts enable row level security;

drop policy if exists "workouts_own" on workouts;
create policy "workouts_own" on workouts for all using (auth.uid() = user_id);

-- ============================================================
-- WORKOUT EXERCISES: Exercises within a workout
-- ============================================================
create table if not exists workout_exercises (
  id           uuid default uuid_generate_v4() primary key,
  workout_id   uuid references workouts(id) on delete cascade not null,
  exercise_id  uuid references exercises(id) on delete set null,
  order_index  integer not null default 0,
  notes        text default ''
);

create index if not exists workout_exercises_workout_idx on workout_exercises(workout_id);

alter table workout_exercises enable row level security;

drop policy if exists "workout_exercises_own" on workout_exercises;
create policy "workout_exercises_own" on workout_exercises for all using (
  exists (select 1 from workouts w where w.id = workout_exercises.workout_id and w.user_id = auth.uid())
);

-- ============================================================
-- SETS: Individual sets within a workout exercise
-- ============================================================
create table if not exists sets (
  id                  uuid default uuid_generate_v4() primary key,
  workout_exercise_id uuid references workout_exercises(id) on delete cascade not null,
  set_number          integer not null,
  set_type            text default 'working' check (set_type in ('warmup','working','drop','failure')),
  weight_kg           numeric(8,2) default 0,
  reps                integer default 0,
  rpe                 numeric(3,1),
  is_pr               boolean default false,
  completed_at        timestamptz default now()
);

create index if not exists sets_workout_exercise_idx on sets(workout_exercise_id);

alter table sets enable row level security;

drop policy if exists "sets_own" on sets;
create policy "sets_own" on sets for all using (
  exists (
    select 1 from workout_exercises we
    join workouts w on w.id = we.workout_id
    where we.id = sets.workout_exercise_id and w.user_id = auth.uid()
  )
);

-- ============================================================
-- PERSONAL RECORDS
-- ============================================================
create table if not exists personal_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles(id) on delete cascade not null,
  exercise_id  uuid not null,
  record_type  text not null check (record_type in ('max_weight', 'max_volume')),
  value        numeric(10,2) not null,
  set_id       uuid,
  achieved_at  timestamptz default now(),
  unique(user_id, exercise_id, record_type)
);

create index if not exists personal_records_user_exercise_idx on personal_records(user_id, exercise_id);

alter table personal_records enable row level security;

drop policy if exists "personal_records_own" on personal_records;
create policy "personal_records_own" on personal_records for all using (auth.uid() = user_id);

-- ============================================================
-- FRIENDSHIPS (app queries this as "friendships")
-- ============================================================
create table if not exists friendships (
  id           uuid default uuid_generate_v4() primary key,
  requester_id uuid not null,
  addressee_id uuid not null,
  status       text not null default 'pending' check (status in ('pending','accepted','rejected','blocked')),
  created_at   timestamptz default now(),
  constraint friendships_requester_profile_fkey foreign key (requester_id) references profiles(id) on delete cascade,
  constraint friendships_addressee_profile_fkey foreign key (addressee_id) references profiles(id) on delete cascade,
  unique(requester_id, addressee_id)
);

create index if not exists friendships_requester_idx on friendships(requester_id, status);
create index if not exists friendships_addressee_idx on friendships(addressee_id, status);

alter table friendships enable row level security;

drop policy if exists "friendships_own" on friendships;
create policy "friendships_own" on friendships for all using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);

-- ============================================================
-- PACTS: Group accountability challenges
-- ============================================================
create table if not exists pacts (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  description text,
  goal_type   text not null check (goal_type in ('workouts_per_week','total_volume','streak_days','custom')),
  goal_target integer not null default 4,
  end_date    timestamptz,
  is_active   boolean not null default true,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists pacts_active_idx on pacts(is_active, created_at desc);

alter table pacts enable row level security;

drop policy if exists "pacts_read_members" on pacts;
drop policy if exists "pacts_write_own" on pacts;
create policy "pacts_read_members" on pacts for select using (
  exists (select 1 from pact_members pm where pm.pact_id = pacts.id and pm.user_id = auth.uid())
  or created_by = auth.uid()
);
create policy "pacts_write_own" on pacts for all using (created_by = auth.uid());
create policy "pacts_insert" on pacts for insert with check (auth.uid() = created_by);

-- ============================================================
-- PACT MEMBERS
-- ============================================================
create table if not exists pact_members (
  id         uuid default uuid_generate_v4() primary key,
  pact_id    uuid references pacts(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  role       text not null default 'member' check (role in ('admin','member')),
  joined_at  timestamptz default now(),
  unique(pact_id, user_id)
);

create index if not exists pact_members_pact_idx on pact_members(pact_id);
create index if not exists pact_members_user_idx on pact_members(user_id);

alter table pact_members enable row level security;

drop policy if exists "pact_members_read" on pact_members;
drop policy if exists "pact_members_write" on pact_members;
create policy "pact_members_read"   on pact_members for select using (
  exists (select 1 from pact_members pm2 where pm2.pact_id = pact_members.pact_id and pm2.user_id = auth.uid())
);
create policy "pact_members_insert" on pact_members for insert with check (auth.uid() = user_id);
create policy "pact_members_delete" on pact_members for delete using (auth.uid() = user_id);

-- ============================================================
-- LEADERBOARD ENTRIES
-- ============================================================
create table if not exists leaderboard_entries (
  id         uuid default uuid_generate_v4() primary key,
  pact_id    uuid references pacts(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  period     text not null default 'weekly' check (period in ('weekly','monthly','all_time')),
  score      integer not null default 0,
  rank       integer,
  updated_at timestamptz default now(),
  unique(pact_id, user_id, period)
);

create index if not exists leaderboard_pact_period_idx on leaderboard_entries(pact_id, period, rank);

alter table leaderboard_entries enable row level security;

drop policy if exists "leaderboard_read_members" on leaderboard_entries;
create policy "leaderboard_read_members" on leaderboard_entries for select using (
  exists (select 1 from pact_members pm where pm.pact_id = leaderboard_entries.pact_id and pm.user_id = auth.uid())
);
create policy "leaderboard_write_own" on leaderboard_entries for all using (auth.uid() = user_id);
create policy "leaderboard_insert" on leaderboard_entries for insert with check (auth.uid() = user_id);

-- ============================================================
-- BODY MEASUREMENTS
-- ============================================================
create table if not exists body_measurements (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references profiles(id) on delete cascade not null,
  date         date not null default current_date,
  weight_kg    numeric(6,2),
  body_fat_pct numeric(5,2),
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists body_measurements_user_date_idx on body_measurements(user_id, date desc);

alter table body_measurements enable row level security;

drop policy if exists "body_measurements_own" on body_measurements;
create policy "body_measurements_own" on body_measurements for all using (auth.uid() = user_id);

-- ============================================================
-- COACHING LOGS: AI-generated post-workout tips
-- ============================================================
create table if not exists coaching_logs (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references profiles(id) on delete cascade not null,
  workout_id    uuid references workouts(id) on delete set null,
  exercise_id   uuid references exercises(id) on delete set null,
  coaching_type text,
  message       text not null,
  data          jsonb default '{}',
  dismissed     boolean not null default false,
  created_at    timestamptz default now()
);

create index if not exists coaching_logs_user_idx on coaching_logs(user_id, dismissed, created_at desc);

alter table coaching_logs enable row level security;

drop policy if exists "coaching_logs_own" on coaching_logs;
create policy "coaching_logs_own" on coaching_logs for all using (auth.uid() = user_id);

-- ============================================================
-- AI PLANS
-- ============================================================
create table if not exists ai_plans (
  id                   uuid default uuid_generate_v4() primary key,
  user_id              uuid references profiles(id) on delete cascade not null,
  plan_name            text not null,
  goal                 text not null check (goal in ('strength','hypertrophy','endurance','weight_loss','general')),
  days_per_week        integer,
  difficulty           text check (difficulty in ('beginner','intermediate','advanced')),
  equipment_available  text,
  plan_data            jsonb not null,
  is_active            boolean default true,
  generated_at         timestamptz default now(),
  created_at           timestamptz default now()
);

create index if not exists ai_plans_user_idx    on ai_plans(user_id, created_at desc);
create index if not exists ai_plans_active_idx  on ai_plans(user_id, is_active);

alter table ai_plans enable row level security;

drop policy if exists "ai_plans_own" on ai_plans;
create policy "ai_plans_own" on ai_plans for all using (auth.uid() = user_id);

-- ============================================================
-- SHARED PLANS
-- ============================================================
create table if not exists shared_plans (
  id           uuid default uuid_generate_v4() primary key,
  sender_id    uuid references profiles(id) on delete cascade not null,
  recipient_id uuid references profiles(id) on delete cascade not null,
  plan_id      uuid references ai_plans(id) on delete set null,
  plan_name    text,
  plan_data    jsonb not null,
  message      text,
  status       text default 'pending' check (status in ('pending','accepted','dismissed')),
  created_at   timestamptz default now(),
  read_at      timestamptz
);

create index if not exists shared_plans_recipient_idx on shared_plans(recipient_id, status, created_at desc);
create index if not exists shared_plans_sender_idx    on shared_plans(sender_id, created_at desc);

alter table shared_plans enable row level security;

drop policy if exists "shared_plans_own" on shared_plans;
create policy "shared_plans_own" on shared_plans for all using (
  auth.uid() = sender_id or auth.uid() = recipient_id
);

-- ============================================================
-- MISSIONS: Catalog
-- ============================================================
create table if not exists missions (
  id             text primary key,
  title          text not null,
  description    text,
  mission_type   text not null check (mission_type in ('daily','weekly','monthly','chain')),
  progress_type  text not null,
  target         integer not null,
  token_reward   integer not null default 0,
  icon           text,
  chain_order    integer,
  chain_name     text,
  is_active      boolean not null default true,
  created_at     timestamptz default now()
);

alter table missions enable row level security;

drop policy if exists "missions_read_all" on missions;
create policy "missions_read_all" on missions for select using (true);

-- ============================================================
-- USER MISSIONS: Progress per user
-- ============================================================
create table if not exists user_missions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade not null,
  mission_id  text references missions(id) not null,
  progress    numeric not null default 0,
  status      text not null default 'in_progress' check (status in ('in_progress','completed','claimed','expired')),
  claimed     boolean not null default false,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, mission_id)
);

alter table user_missions enable row level security;

drop policy if exists "user_missions_own"        on user_missions;
drop policy if exists "user_missions_insert_own" on user_missions;
drop policy if exists "user_missions_update_own" on user_missions;
create policy "user_missions_own"        on user_missions using (auth.uid() = user_id);
create policy "user_missions_insert_own" on user_missions for insert with check (auth.uid() = user_id);
create policy "user_missions_update_own" on user_missions for update using  (auth.uid() = user_id);

-- ============================================================
-- COSMETICS: Catalog (seeded below)
-- ============================================================
create table if not exists cosmetics (
  id          text primary key,
  name        text not null,
  description text,
  category    text not null check (category in ('badge','theme','title','frame')),
  rarity      text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  cost        integer not null default 0,
  icon        text,
  css_class   text,
  effect      jsonb default '{}',
  is_earned   boolean default false,
  created_at  timestamptz default now()
);

alter table cosmetics enable row level security;

drop policy if exists "cosmetics_read_all" on cosmetics;
create policy "cosmetics_read_all" on cosmetics for select using (true);

-- ============================================================
-- USER COSMETICS: Owned items
-- ============================================================
create table if not exists user_cosmetics (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references profiles(id) on delete cascade not null,
  cosmetic_id  text references cosmetics(id) not null,
  purchased_at timestamptz default now(),
  unique(user_id, cosmetic_id)
);

alter table user_cosmetics enable row level security;

drop policy if exists "user_cosmetics_own" on user_cosmetics;
create policy "user_cosmetics_own" on user_cosmetics for all using (auth.uid() = user_id);

-- ============================================================
-- TOKEN TRANSACTIONS
-- ============================================================
create table if not exists token_transactions (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  amount     integer not null,
  type       text not null check (type in ('earned','spent','purchased')),
  reason     text,
  created_at timestamptz default now()
);

alter table token_transactions enable row level security;

drop policy if exists "tokens_own" on token_transactions;
create policy "tokens_own" on token_transactions for all using (auth.uid() = user_id);

-- ============================================================
-- TOKEN LEDGER (fine-grained log, app uses this for audit trail)
-- ============================================================
create table if not exists token_ledger (
  id               uuid default uuid_generate_v4() primary key,
  user_id          uuid references profiles(id) on delete cascade not null,
  amount           integer not null,
  reason           text,
  transaction_type text not null default 'earn' check (transaction_type in ('earn','spend','purchase')),
  created_at       timestamptz default now()
);

create index if not exists token_ledger_user_idx on token_ledger(user_id, created_at desc);

alter table token_ledger enable row level security;

drop policy if exists "token_ledger_own" on token_ledger;
create policy "token_ledger_own" on token_ledger for all using (auth.uid() = user_id);

-- ============================================================
-- FRAUD FLAGS: Anti-abuse logging (fire-and-forget, never blocks UX)
-- ============================================================
create table if not exists fraud_flags (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade not null,
  workout_id  uuid references workouts(id) on delete set null,
  reason      text not null,
  severity    text not null default 'low' check (severity in ('low','medium','high')),
  reviewed    boolean default false,
  created_at  timestamptz default now()
);

alter table fraud_flags enable row level security;

drop policy if exists "fraud_flags_insert_own" on fraud_flags;
create policy "fraud_flags_insert_own" on fraud_flags for insert with check (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Lifter'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Auto-update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_profiles_updated_at on profiles;
create trigger update_profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at_column();

drop trigger if exists update_workouts_updated_at on workouts;
create trigger update_workouts_updated_at
  before update on workouts
  for each row execute procedure update_updated_at_column();

drop trigger if exists update_user_missions_updated_at on user_missions;
create trigger update_user_missions_updated_at
  before update on user_missions
  for each row execute procedure update_updated_at_column();

-- Increment/decrement token balance (used by stripe-webhook and mission claims)
create or replace function increment_tokens(uid uuid, delta integer)
returns void
language plpgsql security definer as $$
begin
  update profiles
    set token_balance = token_balance + delta
    where id = uid;

  insert into token_transactions (user_id, amount, type, reason)
    values (uid, delta, case when delta > 0 then 'earned' else 'spent' end, 'system');
end;
$$;

-- ============================================================
-- SEED: Missions
-- ============================================================
insert into missions (id, title, description, mission_type, progress_type, target, token_reward, icon, chain_order, chain_name)
values
  ('mission-d1','Daily Grind',           'Complete 1 workout today',                    'daily',   'workout_count',       1,      4,   '💪',  null, null),
  ('mission-d2','Volume Crusher',        'Log 5,000 kg total volume today',             'daily',   'total_volume_kg',     5000,   6,   '📊',  null, null),
  ('mission-d3','First Rep of the Day',  'Log any set today',                           'daily',   'set_count',           1,      2,   '🏁',  null, null),
  ('mission-w1','Iron Week',             'Complete 4 workouts this week',               'weekly',  'workout_count',       4,      20,  '🗓️', null, null),
  ('mission-w2','PR Hunter',             'Set 3 personal records this week',            'weekly',  'pr_count',            3,      25,  '🏆',  null, null),
  ('mission-w3','Balanced Builder',      'Train 3 different muscle groups this week',   'weekly',  'muscle_group_workouts',3,     15,  '⚖️', null, null),
  ('mission-w4','Volume King',           'Accumulate 30,000 kg this week',             'weekly',  'total_volume_kg',     30000,  30,  '👑',  null, null),
  ('mission-w5','Full Body Week',        'Train 5 different muscle groups this week',   'weekly',  'muscle_group_workouts',5,     35,  '🌐',  null, null),
  ('mission-w6','Dedicated Athlete',     'Complete 5 workouts this week',               'weekly',  'workout_count',       5,      40,  '⚡',  null, null),
  ('mission-m1','Consistency Champion',  'Train 16+ times this month',                 'monthly', 'workout_count',       16,     75,  '🏅',  null, null),
  ('mission-m2','Streak Master',         'Maintain a 7-day consecutive streak',        'monthly', 'consecutive_days',    7,      50,  '🔥',  null, null),
  ('mission-m3','Volume Legend',         'Log 120,000 kg total volume this month',      'monthly', 'total_volume_kg',     120000, 100, '⚡',  null, null),
  ('mission-m4','Iron Month',            'Log 20+ workouts this month',                'monthly', 'workout_count',       20,     120, '🛡️', null, null),
  ('mission-c1','Forge Beginner',        'Complete your first 5 workouts',             'chain',   'workout_count',       5,      15,  '⬡',   1, 'The Forge Path'),
  ('mission-c2','Forge Apprentice',      'Reach 25 total workouts',                    'chain',   'workout_count',       25,     30,  '🔨',   2, 'The Forge Path'),
  ('mission-c3','Forge Master',          'Reach 100 total workouts',                   'chain',   'workout_count',       100,    100, '⚒️',   3, 'The Forge Path'),
  ('mission-c4','PR Seeker',             'Set your first personal record',             'chain',   'pr_count',            1,      10,  '🌟',   1, 'PR Legend'),
  ('mission-c5','PR Collector',          'Set 10 personal records',                    'chain',   'pr_count',            10,     40,  '💫',   2, 'PR Legend'),
  ('mission-c6','PR Legend',             'Set 50 personal records',                    'chain',   'pr_count',            50,     150, '🏆',   3, 'PR Legend'),
  ('mission-c7','Early Adopter',         'Join IronPact during alpha',                 'chain',   'workout_count',       1,      50,  '🎖️',  1, 'Founding Member'),
  ('mission-c8','Volume Rookie',         'Log 10,000 kg total volume',                 'chain',   'total_volume_kg',     10000,  20,  '💧',   1, 'Volume Warrior'),
  ('mission-c9','Volume Grinder',        'Log 100,000 kg total volume',                'chain',   'total_volume_kg',     100000, 60,  '💦',   2, 'Volume Warrior'),
  ('mission-c10','Volume God',           'Log 1,000,000 kg total volume',              'chain',   'total_volume_kg',     1000000,200, '🌊',   3, 'Volume Warrior')
on conflict (id) do nothing;

-- ============================================================
-- SEED: Cosmetics
-- ============================================================
insert into cosmetics (id, name, description, category, rarity, cost, icon, css_class, is_earned)
values
  -- Badges
  ('cos-b1',  'Iron Novice',         'Given to all members',          'badge', 'common',    0,   '🥉',  null, false),
  ('cos-b2',  'Bronze Lifter',       'A solid start',                 'badge', 'common',    50,  '🏅',  null, false),
  ('cos-b3',  'Silver Strong',       'Proven dedication',             'badge', 'rare',      150, '🥈',  null, false),
  ('cos-b4',  'Gold Crusher',        'Elite performance',             'badge', 'epic',      300, '🥇',  null, false),
  ('cos-b5',  'Diamond Forge',       'Only for the chosen',           'badge', 'legendary', 750, '💎',  null, false),
  ('cos-b6',  'IronPact Founder',    'Alpha founder badge',           'badge', 'legendary', 0,   '⬡',   null, true),
  ('cos-b7',  'Streak Hunter',       '7-day streak achiever',         'badge', 'rare',      200, '🔥',  null, false),
  ('cos-b8',  'PR Machine',          'Personal record setter',        'badge', 'epic',      400, '📈',  null, false),
  -- Themes
  ('cos-t1',  'Default Orange',      'The classic IronPact look',     'theme', 'common',    0,   '🟠',  'theme-default', false),
  ('cos-t2',  'Steel Blue',          'Cold steel aesthetic',          'theme', 'rare',      100, '🔵',  'theme-blue',    false),
  ('cos-t3',  'Toxic Green',         'Radioactive gains',             'theme', 'epic',      250, '🟢',  'theme-green',   false),
  ('cos-t4',  'Royal Purple',        'Royalty in the gym',            'theme', 'epic',      250, '🟣',  'theme-purple',  false),
  ('cos-t5',  'Crimson Power',       'Blood sweat and tears',         'theme', 'legendary', 500, '🔴',  'theme-red',     false),
  ('cos-t6',  'Gold Rush',           'For champions only',            'theme', 'legendary', 500, '🟡',  'theme-gold',    false),
  -- Titles
  ('cos-ti1', 'The Lifter',          'A simple title',                'title', 'common',    0,   '🏷️', null, false),
  ('cos-ti2', 'Iron Warrior',        'Battle-tested',                 'title', 'rare',      120, '⚔️', null, false),
  ('cos-ti3', 'The Crusher',         'Crushing goals',                'title', 'rare',      120, '💥',  null, false),
  ('cos-ti4', 'Forge Master',        'Master of the forge',           'title', 'epic',      350, '⚒️', null, false),
  ('cos-ti5', 'Iron Legend',         'A true legend',                 'title', 'legendary', 800, '👑',  null, false),
  -- Frames
  ('cos-f1',  'Basic Frame',         'Clean and simple',              'frame', 'common',    0,   '⬜',  'frame-basic',  false),
  ('cos-f2',  'Fire Frame',          'Blazing intensity',             'frame', 'rare',      180, '🔥',  'frame-fire',   false),
  ('cos-f3',  'Gold Frame',          'Premium gold border',           'frame', 'epic',      400, '✨',  'frame-gold',   false),
  ('cos-f4',  'Diamond Frame',       'Legendary diamond border',      'frame', 'legendary', 900, '💎',  'frame-diamond', false)
on conflict (id) do nothing;
