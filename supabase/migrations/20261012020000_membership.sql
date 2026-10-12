-- Üyelik: satın alınan planın türü ve yenileme durumu (RevenueCat ile eşitlenir; yalnızca sunucu yazar).
-- Supabase SQL Editor'de bir kez çalıştırılır (ya da `supabase db push`).
alter table public.profiles
  -- monthly · yearly · lifetime (deneme ya da süresi bitmiş üyelikte null)
  add column if not exists plan text check (plan in ('monthly', 'yearly', 'lifetime')),
  -- Abonelik dönem sonunda yenilenecek mi (iptal edildiyse false)
  add column if not exists renews boolean not null default false,
  -- Aboneliğin yönetildiği mağaza sayfası (iptal / ödeme yöntemi)
  add column if not exists management_url text,
  -- Ödeme sorunu (kart reddedildi): kullanıcıya bildirilir
  add column if not exists billing_issue boolean not null default false;
