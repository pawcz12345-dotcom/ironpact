-- ============================================================
-- IronPact — Personal Records Table
-- Run this in the Supabase SQL editor.
-- ============================================================

-- The app queries "personal_records" (not the "prs" table in schema.sql).
-- Without this table every set is incorrectly flagged as a PR.

create table if not exists personal_records (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references profiles(id) on delete cascade not null,
  exercise_id  uuid        not null,
  record_type  text        not null check (record_type in ('max_weight', 'max_volume')),
  value        numeric(10,2) not null,
  set_id       uuid,
  achieved_at  timestamptz default now(),
  unique(user_id, exercise_id, record_type)
);

alter table personal_records enable row level security;

drop policy if exists "personal_records_own" on personal_records;
create policy "personal_records_own" on personal_records
  for all using (auth.uid() = user_id);

create index if not exists personal_records_user_exercise_idx
  on personal_records (user_id, exercise_id);
