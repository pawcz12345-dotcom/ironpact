-- ============================================================
-- IronPact — Alpha welcome tokens
-- Run this in the Supabase SQL editor.
-- ============================================================
-- 1. Changes the default token balance for all NEW signups to 1000
-- 2. Tops up every existing user to 1000 tokens (adds the
--    difference so users with more than 1000 are untouched)
-- 3. Logs a token_ledger entry for each existing user who gets topped up
-- ============================================================

-- ── 0. Ensure token_ledger has all expected columns ─────────────────────────
alter table token_ledger
  add column if not exists reason           text,
  add column if not exists transaction_type text not null default 'earn';

-- ── 1. New users: start with 1000 tokens ────────────────────────────────────
alter table profiles
  alter column token_balance set default 1000;

-- ── 2. Existing users: top up to 1000 ───────────────────────────────────────
do $$
declare
  r record;
  delta integer;
begin
  for r in select id, token_balance from profiles where token_balance < 1000 loop
    delta := 1000 - r.token_balance;
    update profiles set token_balance = 1000 where id = r.id;
    insert into token_ledger (user_id, amount, reason, transaction_type, balance_after, source)
      values (r.id, delta, 'alpha_welcome_gift', 'earn', 1000, 'system');
  end loop;
end;
$$;
