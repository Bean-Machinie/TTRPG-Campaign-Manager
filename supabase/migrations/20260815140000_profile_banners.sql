-- Curated profile banners. Users store only a known preset key; banners cannot
-- be uploaded or supplied as arbitrary URLs.

alter table public.profiles
  add column if not exists banner_preset text not null default 'astral';

alter table public.profiles
  drop constraint if exists profiles_banner_preset,
  add constraint profiles_banner_preset
    check (
      banner_preset in (
        'astral', 'ember', 'verdant', 'amethyst', 'frost', 'parchment'
      )
    );

revoke update on public.profiles from authenticated, anon;
grant update (display_name, headline, bio, avatar_path, avatar_preset, banner_preset)
  on public.profiles to authenticated;
