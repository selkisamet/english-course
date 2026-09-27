# Kullanıcı sistemi kurulumu (Supabase)

Uygulama artık giriş gerektiriyor. Aşağıdaki adımlar tamamlanmadan canlı sitede içerik açılmaz,
bu yüzden **kodu yayına almadan önce** bu adımları bitir.

## 1. Supabase projesi

1. <https://supabase.com> → **New project**. Bölge olarak Avrupa'da bir bölge seç (ör. Frankfurt).
   Veritabanı şifresini güvenli bir yere kaydet.
2. **SQL Editor** → **New query** → `supabase/migrations/20260927000000_users.sql` dosyasının
   içeriğini yapıştır → **Run**. Tablolar, güvenlik kuralları ve deneme süresi tetikleyicisi oluşur.
3. Deneme süresini değiştirmek için (varsayılan 7 gün) SQL Editor'de:
   `update app_config set trial_days = 3;`
4. **Project Settings → API** sayfasından şu üç değeri al:
   - Project URL
   - `anon` / publishable anahtar (tarayıcıda kullanılır, gizli değildir)
   - `service_role` / secret anahtar (**gizlidir**, yalnızca sunucuya girilir, kimseyle paylaşma)

## 2. Giriş ayarları (Authentication)

**Authentication → URL Configuration**
- Site URL: `https://english-course-qlsk.onrender.com`
- Redirect URLs: `https://english-course-qlsk.onrender.com/**` ve `http://localhost:5173/**`

**Authentication → Providers → Email**
- Email açık kalsın, **Confirm email** açık kalsın.
- Şifre en az 8 karakter olsun (Password requirements).

**E-posta ile kod (Authentication → Emails → Templates → Magic Link)**
Şablonda kodun görünmesi için `{{ .Token }}` kullan. Örnek:

```
Konu: English Course giriş kodun
<h2>Giriş kodun</h2>
<p>Uygulamaya dönüp şu kodu gir:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
```

"Confirm signup" ve "Reset Password" şablonlarını da Türkçeleştir (bağlantı için
`{{ .ConfirmationURL }}`).

**Kendi e-posta sunucun (SMTP) — canlıya almadan önce şart**
Supabase'in hazır e-posta servisi yalnızca deneme içindir ve saatte çok az e-posta gönderir.
**Project Settings → Authentication → SMTP Settings** bölümüne Resend, Brevo gibi bir servisin
SMTP bilgilerini gir. Gönderen adresi kendi alan adından olmalı (ör. `noreply@alanadin.com`).

## 3. Google ile giriş

1. <https://console.cloud.google.com> → yeni proje → **APIs & Services → OAuth consent screen**:
   uygulama adı, destek e-postası, logo; kapsamlar: `email`, `profile`, `openid`.
2. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorized JavaScript origins: `https://english-course-qlsk.onrender.com`, `http://localhost:5173`
   - Authorized redirect URIs: Supabase'de **Authentication → Providers → Google** sayfasında
     gösterilen *Callback URL* (`https://<proje>.supabase.co/auth/v1/callback`)
3. Oluşan Client ID ve Client Secret'ı Supabase'de **Providers → Google** sayfasına gir, etkinleştir.
4. Uygulamayı herkese açmak için OAuth consent screen'de **Publish app**.

## 4. Render ortam değişkenleri

Render → servis → **Environment**:

| Anahtar | Değer |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role anahtarı (gizli) |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable anahtar |
| `VITE_CONTACT_EMAIL` | (isteğe bağlı) abonelik ve gizlilik talepleri için iletişim adresi |

`VITE_` ile başlayanlar derleme sırasında uygulamaya gömülür; değiştirdikten sonra yeniden
yayınlamak (Manual Deploy) gerekir.

Yerelde çalıştırmak için aynı değişkenleri proje kökündeki `.env.local` dosyasına ekle.

## 5. Kullanıcı yönetimi

- Kullanıcılar: **Authentication → Users**.
- Bir kullanıcının erişimini uzatmak (ödeme sistemi gelene kadar): **Table Editor → profiles** →
  `access_until` tarihini ileri al, `subscription_status` değerini `active` yap. Sunucu değişikliği
  en geç 1 dakika içinde görür.

## Bilinmesi gerekenler

- Supabase ücretsiz projeleri 1 hafta boyunca hiç istek almazsa duraklatılır. Ücretli
  kullanıcılar olduğunda Pro plana geçilmeli (günlük yedekleme de gelir).
- `src/pages/Legal.jsx` içindeki Gizlilik Politikası ve Kullanım Koşulları **şablondur**;
  satışa çıkmadan önce bir hukukçuya inceletilmeli ve işletme bilgileri eklenmelidir.
