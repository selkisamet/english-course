# Yapılacaklar

Son güncelleme: 12 Ekim 2026

## Öncelikli

- [x] **Gizlilik politikası** gerçek veri akışına göre yeniden yazıldı (12 Ekim 2026). Kalanlar:
  - [ ] **İletişim adresi** (`VITE_CONTACT_EMAIL`) Render'a ve `.env.local`'e eklenecek. Şu an tanımlı değil; bu yüzden "Abonelik için bize yaz" düğmesi de görünmüyor.
  - [ ] Şirket kurulunca **veri sorumlusu unvanı ve adresi** (`VITE_LEGAL_NAME`, `VITE_LEGAL_ADDRESS`).
  - [ ] Satıştan önce gizlilik politikası ve kullanım koşulları **bir hukukçuya inceletilecek** (KVKK aydınlatma metni, yurt dışına aktarım, gerekirse açık rıza).
  - [ ] Veri akışı değişirse (yeni bir hizmet ya da veri) `src/pages/Legal.jsx` güncellenecek; mağazalardaki veri güvenliği formları buna göre doldurulacak.
- [ ] **Ödeme sistemi**: şu an abonelik sayfası yalnızca "bize yaz" diyor.
  - Önce kurgu netleşecek: fiyat, deneme süresi, aylık / yıllık seçenek.
  - Mağaza içi satın alma: Google Play Faturalandırma (ileride App Store), RevenueCat ile yönetim.
  - Web ödemesi (ör. iyzico).
  - Nereden alınırsa alınsın abonelik hesaba işlenmeli (Supabase `profiles.access_until`).

## Ses

- [ ] **Kelime ve örnek cümlelerin erkek sesi** (Brian): Azure ücretsiz (F0) aylık kotası yetmediği için üretilmedi; şu an erkek ses seçiliyken kadın sesi çalıyor. Kota yenilenince:
  `node server/scripts/generateVocabAudio.js --voice male` → `server/data/vocab-audio/male.json` commit'lenecek.
  Yaklaşık 161 bin karakter. Kota ayda 500 bin; hikaye sesleri tamam olduğu için yalnızca bu kalacak.
  - Hikaye seslerinin 300'ünde de kadın ve erkek ses tam. Hikaye metni değişirse o hikayenin sesi yeniden üretilmeli.

## Android uygulaması

- [x] **Google ile giriş** uygulamada çalışıyor (tarayıcıda açılıp englishcourse://login-callback ile uygulamaya dönüyor; Supabase Redirect URLs listesinde kayıtlı).
- [x] **"Ayarları aç" düğmesi**: izin reddedilince telefonun bildirim ayarlarını açıyor; dönünce ekran kendiliğinden güncelleniyor.
- [ ] **Kalıcı paket kimliği ve uygulama adı**: şu an geçici `com.englishcourse.dev`. Değişince Firebase'e yeni Android uygulaması eklenecek ve `google-services.json` yenilenecek.
- [ ] **Yayın derlemesi**: yükleme (imza) anahtarı oluşturulacak ve güvenli saklanacak; imzalı AAB derlenecek.

## Play Store yayını

- [ ] Şirket kurulumu ve **D-U-N-S numarası** (Google ve Apple şirket hesapları için).
- [ ] **Play Console şirket hesabı** (25 $, tek sefer).
- [ ] Mağaza sayfası: ekran görüntüleri, kısa / uzun açıklama, simge, içerik derecelendirmesi, veri güvenliği formu.

## iOS (Android yayına girdikten sonra)

- [ ] **Apple Developer** şirket hesabı (99 $ / yıl).
- [ ] Capacitor iOS projesi; Mac olmadığı için bulutta derleme (ör. Codemagic).
- [ ] **Apple ile giriş** (uygulamada Google girişi olduğu için Apple büyük ihtimalle isteyecek).
- [ ] Bildirimler: Apple (APNs) anahtarı Firebase'e eklenecek.
- [ ] App Store başvurusu.

## Bilgi notları

- Hatırlatma zamanlayıcısı: **cron-job.org**, 5 dakikada bir (asıl). GitHub Actions yalnızca saatte bir çalışan yedek.
- Gizli anahtarlar repoda yok:
  - `.env.local`
  - `firebase-service-account.json` (Render'da Secret File)
  - `cron-secret.local` (Render'daki `CRON_SECRET`, GitHub secret ve cron-job.org'daki değerle aynı)
- Supabase tablo değişiklikleri `supabase/migrations/` içinde; her yenisi Supabase SQL Editor'de elle çalıştırılıyor.
