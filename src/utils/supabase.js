import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

// Oturum tarayıcıda saklanır ve süresi dolmadan otomatik yenilenir.
// PKCE: Google dönüşü ve şifre sıfırlama bağlantıları güvenli kod değişimiyle tamamlanır.
export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } })
  : null

/** API isteklerine eklenecek erişim belirteci (oturum yoksa null) */
export async function getAccessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
