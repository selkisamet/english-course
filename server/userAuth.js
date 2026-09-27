// Kullanıcı girişi ve erişim (deneme / abonelik) kontrolü.
// İstemci Supabase erişim belirtecini "Authorization: Bearer <token>" başlığıyla gönderir.

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { verifyPassword } from './authMiddleware.js'

dotenv.config({ path: '.env.local' })
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

// Yalnızca sunucuda: RLS'yi aşan yetkili istemci (profil okuma, hesap silme)
const admin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null

if (!admin) console.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil: içerik uç noktaları kapalı')

const bearer = (req) => {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

// Erişim bitiş tarihi sık değişmez; her istekte veritabanına gitmemek için kısa süre saklanır
const PROFILE_TTL = 60_000
const profileCache = new Map()

async function getAccessUntil(userId) {
  const cached = profileCache.get(userId)
  if (cached && Date.now() - cached.at < PROFILE_TTL) return cached.accessUntil
  const { data, error } = await admin.from('profiles').select('access_until').eq('id', userId).single()
  if (error) throw error
  const accessUntil = new Date(data.access_until).getTime()
  profileCache.set(userId, { accessUntil, at: Date.now() })
  return accessUntil
}

export const forgetProfile = (userId) => profileCache.delete(userId)

/** Belirteci doğrular ve req.userId'yi ayarlar; erişim süresine bakmaz. */
export async function requireUser(req, res, next) {
  if (!admin) return res.status(503).json({ error: 'Kullanıcı sistemi yapılandırılmadı' })
  const token = bearer(req)
  if (!token) return res.status(401).json({ error: 'Giriş gerekli', code: 'unauthenticated' })
  try {
    const { data, error } = await admin.auth.getClaims(token)
    if (error || !data?.claims?.sub) throw error || new Error('Geçersiz belirteç')
    req.userId = data.claims.sub
    next()
  } catch {
    res.status(401).json({ error: 'Oturum geçersiz ya da süresi dolmuş', code: 'unauthenticated' })
  }
}

/** İçerik uç noktaları: geçerli oturum ve süresi dolmamış deneme/abonelik gerekir.
 *  Yönetim paneli kendi şifresiyle de erişebilir. */
export function requireAccess(req, res, next) {
  const token = bearer(req)
  if (token && verifyPassword(token)) return next()
  requireUser(req, res, async () => {
    try {
      if ((await getAccessUntil(req.userId)) > Date.now()) return next()
      res.status(403).json({ error: 'Deneme süresi ya da abonelik sona erdi', code: 'access_expired' })
    } catch (error) {
      console.error('Profile check error:', error.message)
      res.status(500).json({ error: 'Erişim kontrol edilemedi' })
    }
  })
}

/** Hesabı ve bütün verilerini siler (tablolar auth.users'a "on delete cascade" ile bağlı). */
export async function deleteAccount(userId) {
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw error
  forgetProfile(userId)
}
