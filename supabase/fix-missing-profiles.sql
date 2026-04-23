-- ============================================================
-- IronPact — Backfill missing profile rows
-- Run this in the Supabase SQL editor.
-- ============================================================
-- Creates a profiles row for any auth.users that don't have one.
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING).
-- ============================================================

insert into profiles (id, display_name, token_balance)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1),
    'Lifter'
  ),
  1000
from auth.users u
where not exists (
  select 1 from profiles p where p.id = u.id
)
on conflict (id) do nothing;
