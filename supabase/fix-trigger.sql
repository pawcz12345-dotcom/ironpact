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
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'Lifter'
    )
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never block user creation due to profile insert failure
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
