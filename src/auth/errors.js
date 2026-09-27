// Supabase Auth hata kodları → kullanıcıya gösterilecek Türkçe mesaj

const MESSAGES = {
  invalid_credentials: 'E-posta ya da şifre hatalı.',
  email_not_confirmed: 'E-posta adresin henüz doğrulanmadı. Gelen kutundaki bağlantıya tıkla.',
  user_already_exists: 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.',
  email_exists: 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.',
  weak_password: 'Şifre çok zayıf. En az 8 karakter; harf ve rakam kullan.',
  same_password: 'Yeni şifre eskisiyle aynı olamaz.',
  otp_expired: 'Kodun süresi dolmuş ya da kod hatalı. Yeni kod iste.',
  over_email_send_rate_limit: 'Çok fazla e-posta istendi. Birkaç dakika sonra tekrar dene.',
  over_request_rate_limit: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
  email_address_invalid: 'Geçerli bir e-posta adresi yaz.',
  validation_failed: 'Bilgileri kontrol edip tekrar dene.',
  signup_disabled: 'Yeni hesap açma şu an kapalı.'
}

export function authErrorMessage(error) {
  if (!error) return ''
  if (MESSAGES[error.code]) return MESSAGES[error.code]
  if (!navigator.onLine) return 'İnternet bağlantısı yok. Bağlanıp tekrar dene.'
  return 'Bir sorun oluştu. Lütfen tekrar dene.'
}

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

export const MIN_PASSWORD = 8
