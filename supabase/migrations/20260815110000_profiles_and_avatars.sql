-- Rich user profiles and secure avatar uploads.

alter table public.profiles
  add column if not exists headline text,
  add column if not exists bio text,
  add column if not exists avatar_path text,
  add column if not exists avatar_preset text;

alter table public.profiles
  drop constraint if exists profiles_headline_length,
  add constraint profiles_headline_length
    check (headline is null or char_length(btrim(headline)) between 1 and 100),
  drop constraint if exists profiles_bio_length,
  add constraint profiles_bio_length
    check (bio is null or char_length(btrim(bio)) between 1 and 500),
  drop constraint if exists profiles_avatar_path_owner,
  add constraint profiles_avatar_path_owner
    check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text),
  drop constraint if exists profiles_avatar_choice,
  add constraint profiles_avatar_choice
    check (avatar_path is null or avatar_preset is null),
  drop constraint if exists profiles_avatar_preset,
  add constraint profiles_avatar_preset
    check (
      avatar_preset is null or avatar_preset in (
        'knight', 'elf', 'dwarf', 'tiefling',
        'orc', 'halfling', 'dragonborn', 'cleric'
      )
    );

-- The existing row policy still guarantees a user can update only themselves.
-- Column grants prevent profile edits from touching the trigger-owned email.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, headline, bio, avatar_path, avatar_preset)
  on public.profiles to authenticated;

-- Profile images are private. A signed URL is created only after the profile
-- row itself has passed its campaign-mate visibility policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their own profile avatars" on storage.objects;
create policy "Users upload their own profile avatars"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users read visible profile avatars" on storage.objects;
create policy "Users read visible profile avatars"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-avatars'
    and exists (
      select 1
      from public.profiles p
      where p.avatar_path = name
        and (p.id = (select auth.uid()) or public.shares_campaign_with(p.id))
    )
  );

drop policy if exists "Users delete their own profile avatars" on storage.objects;
create policy "Users delete their own profile avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
