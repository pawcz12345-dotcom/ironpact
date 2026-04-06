-- ============================================================
-- IronPact — Missions, Cosmetics & Extended Profile Migration
-- Run this in the Supabase SQL editor.
-- This is the missing migration for the missions/shop system.
-- ============================================================

-- ── 1. Missing profile columns ───────────────────────────────────────────────
-- These are queried by sbLoadTokenBalance() in the app. Without them,
-- the SELECT fails silently and token/cosmetic state never loads.

alter table profiles
  add column if not exists is_beta_user          boolean      not null default false,
  add column if not exists is_premium            boolean      not null default false,
  add column if not exists subscription_plan     text         not null default 'free',
  add column if not exists equipped_title        text,
  add column if not exists equipped_badge        text,
  add column if not exists equipped_theme        text,
  add column if not exists equipped_frame        text,
  add column if not exists daily_workout_count   integer      not null default 0,
  add column if not exists last_workout_credited_at timestamptz,
  add column if not exists weekly_tokens_earned  integer      not null default 0,
  add column if not exists week_reset_at         timestamptz,
  add column if not exists login_streak          integer      not null default 0,
  add column if not exists longest_login_streak  integer      not null default 0,
  add column if not exists last_login_date       date;

-- ── 2. missions table ────────────────────────────────────────────────────────
-- Uses TEXT primary key matching the JS seedMissions() IDs (e.g. "mission-d1")
-- so the app can resolve missions by ID without UUID mismatch issues.

create table if not exists missions (
  id            text        primary key,
  title         text        not null,
  description   text,
  mission_type  text        not null check (mission_type in ('daily','weekly','monthly','chain')),
  progress_type text        not null,
  target        integer     not null,
  token_reward  integer     not null default 0,
  icon          text,
  chain_order   integer,
  chain_name    text,
  is_active     boolean     not null default true,
  created_at    timestamptz default now()
);

alter table missions enable row level security;

drop policy if exists "missions_read_all" on missions;
create policy "missions_read_all" on missions for select using (true);

-- ── 3. Seed missions (matches seedMissions() in app.js lines 5638–5797) ─────
-- ON CONFLICT DO NOTHING makes this safe to re-run.

insert into missions (id, title, description, mission_type, progress_type, target, token_reward, icon) values
  ('mission-d1', 'Daily Grind',    'Complete 1 workout today',                      'daily',   'workout_count',       1,    5,  '💪'),
  ('mission-d2', 'Volume Crusher', 'Log 5,000 kg total volume today',               'daily',   'total_volume_kg',     5000, 8,  '📊'),
  ('mission-w1', 'Iron Week',      'Complete 4 workouts this week',                 'weekly',  'workout_count',       4,    20, '🗓️'),
  ('mission-w2', 'PR Hunter',      'Set 3 personal records this week',              'weekly',  'pr_count',            3,    25, '🏆'),
  ('mission-w3', 'Balanced Builder','Train 3 different muscle groups this week',    'weekly',  'muscle_group_workouts',3,   15, '⚖️'),
  ('mission-w4', 'Volume King',    'Accumulate 30,000 kg this week',                'weekly',  'total_volume_kg',     30000,30, '👑'),
  ('mission-m1', 'Consistency Champion','Train 16+ times this month',               'monthly', 'workout_count',       16,   75, '🏅'),
  ('mission-m2', 'Streak Master',  'Maintain a 7-day consecutive streak',           'monthly', 'consecutive_days',    7,    50, '🔥'),
  ('mission-m3', 'Volume Legend',  'Log 120,000 kg total volume this month',        'monthly', 'total_volume_kg',     120000,100,'⚡')
on conflict (id) do nothing;

insert into missions (id, title, description, mission_type, progress_type, target, token_reward, icon, chain_order, chain_name) values
  ('mission-c1', 'Forge Beginner',  'Complete your first 5 workouts',       'chain', 'workout_count', 5,   15,  '⬡',   1, 'The Forge Path'),
  ('mission-c2', 'Forge Apprentice','Reach 25 total workouts',              'chain', 'workout_count', 25,  30,  '🔨',  2, 'The Forge Path'),
  ('mission-c3', 'Forge Master',    'Reach 100 total workouts',             'chain', 'workout_count', 100, 100, '⚒️', 3, 'The Forge Path'),
  ('mission-c4', 'PR Seeker',       'Set your first personal record',       'chain', 'pr_count',      1,   10,  '🌟',  1, 'PR Legend'),
  ('mission-c5', 'PR Collector',    'Set 10 personal records',              'chain', 'pr_count',      10,  40,  '💫',  2, 'PR Legend'),
  ('mission-c6', 'PR Legend',       'Set 50 personal records',              'chain', 'pr_count',      50,  150, '🏆',  3, 'PR Legend'),
  ('mission-c7', 'Early Adopter',   'Join IronPact during beta',            'chain', 'workout_count', 1,   50,  '🎖️', 1, 'Founding Member')
on conflict (id) do nothing;

-- ── 4. user_missions table ───────────────────────────────────────────────────

create table if not exists user_missions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references profiles(id) on delete cascade not null,
  mission_id  text        references missions(id) on delete cascade not null,
  progress    integer     not null default 0,
  status      text        not null default 'in_progress'
                check (status in ('in_progress','completed','claimed','expired')),
  claimed     boolean     not null default false,
  claimed_at  timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz default now(),
  unique(user_id, mission_id)
);

alter table user_missions enable row level security;

drop policy if exists "user_missions_own" on user_missions;
create policy "user_missions_own" on user_missions
  for all using (auth.uid() = user_id);

-- ── 5. earn_tokens RPC ───────────────────────────────────────────────────────
-- The app calls supabase.rpc("earn_tokens", ...) but tokens.sql only defines
-- increment_tokens(). This adds the expected function.

create or replace function earn_tokens(
  p_user_id uuid,
  p_amount   integer,
  p_reason   text default null
)
returns void
language plpgsql
security definer
as $$
begin
  update profiles
    set token_balance = token_balance + p_amount
    where id = p_user_id;

  insert into token_transactions (user_id, amount, type, reason)
    values (p_user_id, p_amount, 'earned', p_reason);
end;
$$;

-- ── 6. cosmetics table ───────────────────────────────────────────────────────
-- Uses TEXT primary key matching seedCosmetics() IDs (e.g. "cos-b1").

create table if not exists cosmetics (
  id          text        primary key,
  name        text        not null,
  type        text        not null,   -- badge | theme | title | frame
  rarity      text        not null default 'common',
  token_cost  integer     not null default 0,
  icon        text,
  description text,
  is_active   boolean     not null default true
);

alter table cosmetics enable row level security;

drop policy if exists "cosmetics_read_all" on cosmetics;
create policy "cosmetics_read_all" on cosmetics for select using (true);

-- Seed cosmetics (matches seedCosmetics() in app.js lines 5799–6001)
insert into cosmetics (id, name, type, rarity, token_cost, icon, description) values
  -- Badges
  ('cos-b1', 'Iron Novice',       'badge', 'common',    0,   '🥉', 'Given to all members'),
  ('cos-b2', 'Bronze Lifter',     'badge', 'common',    50,  '🏅', 'A solid start'),
  ('cos-b3', 'Silver Strong',     'badge', 'rare',      150, '🥈', 'Proven dedication'),
  ('cos-b4', 'Gold Crusher',      'badge', 'epic',      300, '🥇', 'Elite performance'),
  ('cos-b5', 'Diamond Forge',     'badge', 'legendary', 750, '💎', 'Only for the chosen'),
  ('cos-b6', 'Iron Pact Founder', 'badge', 'legendary', 0,   '⬡', 'Beta founder badge'),
  ('cos-b7', 'Streak Hunter',     'badge', 'rare',      200, '🔥', '7-day streak achiever'),
  ('cos-b8', 'PR Machine',        'badge', 'epic',      400, '📈', 'Personal record setter'),
  -- Themes
  ('cos-t1', 'Default Orange',    'theme', 'common',    0,   '🟠', 'The classic IronPact look'),
  ('cos-t2', 'Steel Blue',        'theme', 'rare',      100, '🔵', 'Cold steel aesthetic'),
  ('cos-t3', 'Toxic Green',       'theme', 'epic',      250, '🟢', 'Radioactive gains'),
  ('cos-t4', 'Royal Purple',      'theme', 'epic',      250, '🟣', 'Royalty in the gym'),
  ('cos-t5', 'Crimson Power',     'theme', 'legendary', 500, '🔴', 'Blood sweat and tears'),
  ('cos-t6', 'Gold Rush',         'theme', 'legendary', 500, '🟡', 'For champions only'),
  -- Titles
  ('cos-ti1','The Lifter',        'title', 'common',    0,   '🏷️','A simple title'),
  ('cos-ti2','Iron Warrior',      'title', 'rare',      120, '⚔️', 'Battle-tested'),
  ('cos-ti3','The Crusher',       'title', 'rare',      120, '💥', 'Crushing goals'),
  ('cos-ti4','Forge Master',      'title', 'epic',      280, '🔨', 'Master of the forge'),
  ('cos-ti5','Iron Legend',       'title', 'legendary', 600, '👑', 'A legendary title'),
  ('cos-ti6','The OG',            'title', 'legendary', 0,   '🎖️','Original beta tester'),
  -- Frames
  ('cos-f1', 'Basic Frame',       'frame', 'common',    0,   '⬜', 'Simple border'),
  ('cos-f2', 'Flame Frame',       'frame', 'epic',      350, '🔥', 'Burning ambition'),
  ('cos-f3', 'Circuit Frame',     'frame', 'rare',      180, '⚡', 'Digital circuit aesthetic'),
  ('cos-f4', 'Legendary Aura',    'frame', 'legendary', 800, '✨', 'The rarest of auras')
on conflict (id) do nothing;

-- ── 7. user_cosmetics table ──────────────────────────────────────────────────

create table if not exists user_cosmetics (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references profiles(id) on delete cascade not null,
  cosmetic_id text        references cosmetics(id) on delete cascade not null,
  purchased_at timestamptz default now(),
  unique(user_id, cosmetic_id)
);

alter table user_cosmetics enable row level security;

drop policy if exists "user_cosmetics_own" on user_cosmetics;
create policy "user_cosmetics_own" on user_cosmetics
  for all using (auth.uid() = user_id);

-- ── 8. Auto-grant free cosmetics to new users ────────────────────────────────
-- Extend handle_new_user() trigger to grant the 4 free cosmetics on signup.

create or replace function handle_new_user()
returns trigger as $$
declare
  _username text;
  _display  text;
begin
  _username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1));
  _display  := coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', 'Lifter');

  insert into profiles (id, display_name, username, email)
  values (new.id, _display, _username, new.email)
  on conflict (id) do nothing;

  -- Grant free cosmetics (cost = 0) to every new user
  insert into user_cosmetics (user_id, cosmetic_id)
    select new.id, id from cosmetics where token_cost = 0
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer;
