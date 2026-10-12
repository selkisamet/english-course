-- Ücretli dönemin gerçek bitişi (abonelikte yenilenme / bitiş tarihi). access_until deneme ile
-- ödemenin geç olanıdır; "… tarihinde yenilenecek" yazısı bu alandan gösterilir.
-- Supabase SQL Editor'de bir kez çalıştırılır (ya da `supabase db push`).
alter table public.profiles
  add column if not exists period_ends_at timestamptz;
