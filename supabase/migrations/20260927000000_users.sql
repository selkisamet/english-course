-- Kullanıcı altyapısı: profil (deneme/abonelik erişimi) ve senkronize ilerleme.
-- Supabase SQL Editor'de bir kez çalıştırılır (ya da `supabase db push`).

-- ---------- Ayarlar ----------
-- Deneme süresi (gün). Değiştirmek için: update app_config set trial_days = 3;
create table if not exists public.app_config (
  id boolean primary key default true check (id),
  trial_days integer not null default 7 check (trial_days >= 0)
);
insert into public.app_config (id) values (true) on conflict do nothing;
alter table public.app_config enable row level security;

-- ---------- Profil ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  trial_ends_at timestamptz not null,
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'expired')),
  access_until timestamptz not null
);
alter table public.profiles enable row level security;

drop policy if exists "Kullanıcı kendi profilini okur" on public.profiles;
create policy "Kullanıcı kendi profilini okur" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- Kullanıcı yalnızca adını değiştirebilir; erişim alanları yalnızca sunucu (service role) tarafından
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
drop policy if exists "Kullanıcı kendi adını günceller" on public.profiles;
create policy "Kullanıcı kendi adını günceller" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Yeni kullanıcıya deneme süresiyle profil aç
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  days integer := coalesce((select trial_days from public.app_config limit 1), 7);
  ends timestamptz := now() + make_interval(days => days);
begin
  insert into public.profiles (id, display_name, trial_ends_at, access_until)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    ends,
    ends
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Kelime ilerlemesi ----------
create table if not exists public.word_progress (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  word_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);
alter table public.word_progress enable row level security;
drop policy if exists "Kendi kelime ilerlemesi" on public.word_progress;
create policy "Kendi kelime ilerlemesi" on public.word_progress
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Okunan hikayeler ----------
create table if not exists public.read_stories (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  story_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, story_id)
);
alter table public.read_stories enable row level security;
drop policy if exists "Kendi okuduğu hikayeler" on public.read_stories;
create policy "Kendi okuduğu hikayeler" on public.read_stories
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Tercihler ----------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
drop policy if exists "Kendi tercihleri" on public.user_settings;
create policy "Kendi tercihleri" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
