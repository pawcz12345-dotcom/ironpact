-- ============================================================
-- IronPact — Token System SQL
-- Run this in the Supabase SQL editor.
-- ============================================================

-- RPC: increment_tokens
-- Atomically adds delta to a user's token_balance.
-- Used by Cloud.awardTokens() to avoid read-modify-write races.
create or replace function increment_tokens(uid uuid, delta integer)
returns void
language plpgsql
security definer
as $$
begin
  update profiles
  set token_balance = token_balance + delta
  where id = uid;
end;
$$;
