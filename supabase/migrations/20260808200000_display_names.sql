-- Display names.
--
-- Every list that shows a person (members, "played by" on a character) has been
-- rendering a raw email address. A profile may now carry a chosen name instead.

alter table public.profiles
  add column if not exists display_name text
  check (display_name is null or char_length(btrim(display_name)) between 1 and 60);

-- A user may edit their own profile row...
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ...but only the display_name column. A row level security policy cannot
-- compare against the old row, so a column level grant is what keeps `email` in
-- step with auth.users: the sync trigger writes it, nobody else can.
revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;
