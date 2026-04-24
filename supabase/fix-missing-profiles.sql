-- ============================================================
-- IronPact — Backfill missing profile rows
-- Run this in the Supabase SQL editor.
-- ============================================================
-- Creates a profiles row for any auth.users that don't have one.
-- Derives username from the email prefix; appends a suffix if
-- that username is already taken by another profile.
-- Safe to run multiple times.
-- ============================================================

do $$
declare
  u     record;
  uname text;
  dname text;
  suffix int := 0;
  candidate text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    where not exists (select 1 from profiles p where p.id = au.id)
  loop
    -- Build display name
    dname := coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1),
      'Lifter'
    );

    -- Build a unique username from the email prefix
    uname := lower(regexp_replace(
      coalesce(split_part(nullif(u.email, ''), '@', 1), left(u.id::text, 8)),
      '[^a-z0-9_]', '_', 'g'
    ));
    uname := left(uname, 28); -- leave room for suffix

    candidate := uname;
    suffix    := 0;
    while exists (select 1 from profiles where username = candidate) loop
      suffix    := suffix + 1;
      candidate := uname || '_' || suffix::text;
    end loop;

    insert into profiles (id, username, display_name, token_balance)
    values (u.id, candidate, dname, 1000)
    on conflict (id) do nothing;

    raise notice 'Created profile for % with username=%', u.id, candidate;
  end loop;
end;
$$;
