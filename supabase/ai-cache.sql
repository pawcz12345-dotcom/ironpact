-- ============================================================
-- IronPact — AI Cache Table
-- Run this in the Supabase SQL editor.
-- ============================================================

create table if not exists ai_cache (
  id uuid default uuid_generate_v4() primary key,
  cache_key text not null,
  user_id uuid references profiles(id) on delete cascade not null,
  result jsonb not null,
  created_at timestamptz default now()
);

create index if not exists ai_cache_key_idx on ai_cache(cache_key, created_at desc);

alter table ai_cache enable row level security;

drop policy if exists "ai_cache_own" on ai_cache;
create policy "ai_cache_own" on ai_cache for all using (auth.uid() = user_id);
