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
  r            record;
  delta        integer;
  valid_source text;
  src_check    text;
begin
  -- Discover a valid value for the source column by inspecting the check constraint.
  -- Falls back to reusing whatever existing rows have, then to 'admin'.
  select source into valid_source from token_ledger where source is not null limit 1;

  if valid_source is null then
    select pg_get_constraintdef(oid) into src_check
    from pg_constraint
    where conrelid = 'token_ledger'::regclass
      and conname  = 'token_ledger_source_check';

    raise notice 'token_ledger_source_check: %', src_check;

    -- Extract the first quoted value from e.g. CHECK (source = ANY (ARRAY['purchase'::text, ...]))
    -- or CHECK (source IN ('purchase', ...))
    valid_source := (regexp_matches(src_check, '''([^'']+)'''))[1];
  end if;

  -- Last-resort fallbacks tried in order
  if valid_source is null then valid_source := 'admin';    end if;

  raise notice 'Using source = ''%'' for alpha_welcome_gift inserts', valid_source;

  for r in select id, token_balance from profiles where token_balance < 1000 loop
    delta := 1000 - r.token_balance;
    update profiles set token_balance = 1000 where id = r.id;
    insert into token_ledger (user_id, amount, reason, transaction_type, balance_after, source)
      values (r.id, delta, 'alpha_welcome_gift', 'earn', 1000, valid_source);
  end loop;
end;
$$;
