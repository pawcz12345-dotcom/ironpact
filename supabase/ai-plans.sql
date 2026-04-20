-- AI Plans migration
-- Run this in the Supabase SQL editor if you already have the base schema deployed.

create table if not exists ai_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  plan_name text not null,
  goal text not null check (goal in ('strength', 'hypertrophy', 'endurance', 'weight_loss', 'general')),
  days_per_week integer,
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  equipment_available text,
  plan_data jsonb not null,
  is_active boolean default true,
  generated_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists ai_plans_user_idx on ai_plans(user_id, created_at desc);
create index if not exists ai_plans_active_idx on ai_plans(user_id, is_active);

alter table ai_plans enable row level security;

drop policy if exists "ai_plans_own" on ai_plans;
create policy "ai_plans_own" on ai_plans for all using (auth.uid() = user_id);

create table if not exists shared_plans (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references profiles(id) on delete cascade not null,
  recipient_id uuid references profiles(id) on delete cascade not null,
  plan_id uuid references ai_plans(id) on delete set null,
  plan_name text,
  plan_data jsonb not null,
  message text,
  status text default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists shared_plans_recipient_idx on shared_plans(recipient_id, status, created_at desc);
create index if not exists shared_plans_sender_idx on shared_plans(sender_id, created_at desc);

alter table shared_plans enable row level security;

drop policy if exists "shared_plans_own" on shared_plans;
create policy "shared_plans_own" on shared_plans for all using (
  auth.uid() = sender_id or auth.uid() = recipient_id
);
