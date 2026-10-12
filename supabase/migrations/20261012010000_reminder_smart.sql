-- Hatırlatmalar: seri kurtarma bildirimi, şablon çeşitliliği ve uzun aradan sonra sessizleşme.
-- Supabase SQL Editor'de bir kez çalıştırılır (ya da `supabase db push`).
alter table public.reminder_prefs
  -- Serisi 3+ gün olan, o gün çalışmamış kullanıcıya akşam ikinci (son) bildirim
  add column if not exists streak_saver boolean not null default true,
  add column if not exists last_saver_day date,
  -- Son gönderilen metin şablonu (arka arkaya aynısı gitmesin)
  add column if not exists last_template text,
  -- Hatırlatmaların (bildirim ya da e-posta) açıldığı gün: sessizleşme yalnızca bu günden sonrasını sayar
  add column if not exists enabled_on date,
  -- "Ara veriyoruz" mesajının gönderildiği gün (aynı ara için bir kez)
  add column if not exists pause_notice_day date;
