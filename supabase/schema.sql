-- ============================================================
-- IronPact — Supabase Database Schema
-- Paste this into the Supabase SQL editor and run it.
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends Supabase auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null default 'Lifter',
  username text unique,
  email text,
  unit text not null default 'kg' check (unit in ('kg', 'lbs')),
  token_balance integer not null default 10,
  emoji text default '💪',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sessions
create table if not exists sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  type text not null check (type in ('push', 'pull', 'legs', 'core')),
  duration_minutes integer,
  bodyweight numeric(5,2),
  notes text,
  program_version integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Exercises (within a session)
create table if not exists exercises (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references sessions(id) on delete cascade not null,
  name text not null,
  "order" integer not null default 0
);

-- Sets (within an exercise)
create table if not exists sets (
  id uuid default uuid_generate_v4() primary key,
  exercise_id uuid references exercises(id) on delete cascade not null,
  set_number integer not null,
  weight numeric(6,2),
  reps integer,
  rir integer,
  is_pr boolean default false,
  e1rm numeric(6,2)
);

-- Personal Records
create table if not exists prs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  exercise_name text not null,
  weight numeric(6,2) not null,
  reps integer not null,
  e1rm numeric(6,2),
  session_id uuid references sessions(id) on delete set null,
  achieved_at date not null,
  unique(user_id, exercise_name)
);

-- Programs
create table if not exists programs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  version integer not null default 1,
  data jsonb not null,
  saved_at timestamptz default now()
);

-- Friend connections
create table if not exists friend_connections (
  id uuid default uuid_generate_v4() primary key,
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- Token transactions
create table if not exists token_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  amount integer not null,
  type text not null check (type in ('earned', 'spent', 'purchased')),
  reason text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table sessions enable row level security;
alter table exercises enable row level security;
alter table sets enable row level security;
alter table prs enable row level security;
alter table programs enable row level security;
alter table friend_connections enable row level security;
alter table token_transactions enable row level security;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Profiles: users can read their own; write own only
drop policy if exists "profiles_read_own" on profiles;
create policy "profiles_read_own" on profiles for select using (auth.uid() = id);

drop policy if exists "profiles_write_own" on profiles;
create policy "profiles_write_own" on profiles for all using (auth.uid() = id);

-- Allow reading friend profiles (needed for compare / friend search)
drop policy if exists "profiles_read_friends" on profiles;
create policy "profiles_read_friends" on profiles for select using (
  exists (
    select 1 from friend_connections fc
    where fc.status = 'accepted'
      and (
        (fc.requester_id = auth.uid() and fc.addressee_id = id)
        or
        (fc.addressee_id = auth.uid() and fc.requester_id = id)
      )
  )
);

-- Allow finding users by username (for friend requests)
drop policy if exists "profiles_read_by_username" on profiles;
create policy "profiles_read_by_username" on profiles for select using (username is not null);

-- Sessions: own only (friends access handled via edge function if needed)
drop policy if exists "sessions_own" on sessions;
create policy "sessions_own" on sessions for all using (auth.uid() = user_id);

-- Exercises: via session ownership
drop policy if exists "exercises_own" on exercises;
create policy "exercises_own" on exercises for all using (
  exists (select 1 from sessions where sessions.id = exercises.session_id and sessions.user_id = auth.uid())
);

-- Sets: via exercise -> session ownership
drop policy if exists "sets_own" on sets;
create policy "sets_own" on sets for all using (
  exists (
    select 1 from exercises
    join sessions on sessions.id = exercises.session_id
    where exercises.id = sets.exercise_id and sessions.user_id = auth.uid()
  )
);

-- PRs: own only
drop policy if exists "prs_own" on prs;
create policy "prs_own" on prs for all using (auth.uid() = user_id);

-- Programs: own only
drop policy if exists "programs_own" on programs;
create policy "programs_own" on programs for all using (auth.uid() = user_id);

-- Friend connections: involved parties only
drop policy if exists "friends_own" on friend_connections;
create policy "friends_own" on friend_connections for all using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);

-- Token transactions: own only
drop policy if exists "tokens_own" on token_transactions;
create policy "tokens_own" on token_transactions for all using (auth.uid() = user_id);

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

-- Drop and recreate trigger to avoid duplicates
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Auto-update updated_at timestamp
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

drop trigger if exists update_sessions_updated_at on sessions;
create trigger update_sessions_updated_at
  before update on sessions
  for each row execute procedure update_updated_at_column();
