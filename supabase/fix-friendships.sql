-- ============================================================
-- IronPact — Fix: friendships table
-- ============================================================
-- Run this if you deployed from the OLD schema.sql which created
-- a "friend_connections" table. The app queries "friendships"
-- with FK hints friendships_requester_profile_fkey and
-- friendships_addressee_profile_fkey — this migration aligns
-- the DB to match.
--
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- Step 1: Create the friendships table with the correct FK constraint names
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

-- Step 2: Enable RLS
alter table friendships enable row level security;

drop policy if exists "friendships_own" on friendships;
create policy "friendships_own" on friendships for all using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);

-- Step 3: Migrate any existing data from friend_connections -> friendships
insert into friendships (id, requester_id, addressee_id, status, created_at)
select id, requester_id, addressee_id, status, created_at
from friend_connections
on conflict (requester_id, addressee_id) do nothing;

-- Step 4: Update the profiles RLS policy that references friend_connections
drop policy if exists "profiles_read_friends" on profiles;
create policy "profiles_read_friends" on profiles for select using (
  exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = id)
        or (f.addressee_id = auth.uid() and f.requester_id = id))
  )
);

-- Step 5: (Optional) Drop the old table once you've confirmed the migration
-- Only run this after verifying friendships has all your data:
--   DROP TABLE IF EXISTS friend_connections;
