-- Fix the profile creation trigger
-- The original trigger tried to insert 'email' which may not exist yet

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
end;
$$ language plpgsql security definer;
