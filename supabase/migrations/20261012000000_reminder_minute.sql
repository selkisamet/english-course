-- Hatırlatma saati dakikalı olsun (kullanıcı istediği saati seçebilsin, ör. 07:45).
-- Supabase SQL Editor'de bir kez çalıştırılır (ya da `supabase db push`).
alter table public.reminder_prefs
  add column if not exists minute smallint not null default 0 check (minute between 0 and 59);
