-- Günlük hatırlatmalar: kullanıcı tercihleri ve telefon bildirim kimlikleri.
-- Supabase SQL Editor'de bir kez çalıştırılır (ya da `supabase db push`).
-- İki tabloya da yalnızca sunucu (service role) erişir; uygulama sunucunun API'sini kullanır.

-- ---------- Hatırlatma tercihleri ----------
create table if not exists public.reminder_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default false,
  email_enabled boolean not null default false,
  -- Kullanıcının yerel saatiyle hatırlatma saati (0–23)
  hour smallint not null default 19 check (hour between 0 and 23),
  timezone text not null default 'Europe/Istanbul',
  -- Aynı gün ikinci kez gönderilmesin (kullanıcının yerel günü)
  last_push_day date,
  last_email_day date,
  updated_at timestamptz not null default now()
);
alter table public.reminder_prefs enable row level security;

-- ---------- Telefon bildirim kimlikleri (Firebase Cloud Messaging) ----------
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
