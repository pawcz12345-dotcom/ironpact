-- ============================================================
-- IronPact — Profile Body Weight Column
-- Run this in the Supabase SQL editor.
-- ============================================================
-- Adds weight_kg to profiles so the bodyweight input on the
-- profile page persists and is used for bodyweight exercise
-- calculations (getBodyweightKg() reads profile.weight_kg).

alter table profiles
  add column if not exists weight_kg numeric(6,2),
  add column if not exists body_weight numeric(6,2);
