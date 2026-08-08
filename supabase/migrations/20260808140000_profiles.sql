-- A readable identity for each auth.users row.
--
-- auth.users is not exposed through the API, so anything that needs to show
-- *who* someone is (member lists now; note authors, character owners later)
-- reads public.profiles instead.
--
-- Writes are owned entirely by the trigger below, which is why the table has no
-- insert or update policy.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- sync --

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public.profiles (id, email)
  values (new.id, lower(btrim(new.email)))
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_from_auth_user();

-- Anyone who signed up before this migration.
insert into public.profiles (id, email)
select u.id, lower(btrim(u.email))
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------- rls --

alter table public.profiles enable row level security;

-- Security definer so the policy below does not re-enter profiles' own policy.
create or replace function public.shares_campaign_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_memberships mine
    join public.campaign_memberships theirs on theirs.campaign_id = mine.campaign_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

drop policy if exists "Users can read themselves and their campaign mates" on public.profiles;
create policy "Users can read themselves and their campaign mates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_campaign_with(id));
