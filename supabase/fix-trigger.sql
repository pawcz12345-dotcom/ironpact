-- ============================================================
-- IronPact — Fix profile creation trigger
-- Run this in the Supabase SQL editor.
-- ============================================================
-- Wraps the profile insert in an exception handler so a failed
-- insert never blocks user creation. Also removes the email
-- column from the insert (it can be null during OAuth flows).
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
declare
  uname     text;
  dname     text;
  suffix    int := 0;
  candidate text;
begin
  dname := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Lifter'
  );

  uname := lower(regexp_replace(
    coalesce(split_part(nullif(new.email, ''), '@', 1), left(new.id::text, 8)),
    '[^a-z0-9_]', '_', 'g'
  ));
  uname     := left(uname, 28);
  candidate := uname;

  while exists (select 1 from profiles where username = candidate) loop
    suffix    := suffix + 1;
    candidate := uname || '_' || suffix::text;
  end loop;

  insert into profiles (id, username, display_name, token_balance)
  values (new.id, candidate, dname, 1000)
  on conflict (id) do nothing;

  return new;
exception when others then
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
