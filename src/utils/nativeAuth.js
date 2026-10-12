// Telefon uygulamasında Google ile giriş.
// Google, uygulama içi tarayıcıda (WebView) girişe izin vermez; giriş sayfası telefonun tarayıcısında
// uygulamanın üstünde açılır. Giriş bitince Supabase "englishcourse://login-callback?code=…" adresine
// döner; Android bu adresi uygulamaya verir ve oturum kod değişimiyle (PKCE) açılır.

import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { isNative } from './platform'
import { supabase } from './supabase'

// Supabase › Authentication › URL Configuration › Redirect URLs listesinde olmalı
export const NATIVE_AUTH_REDIRECT = 'englishcourse://login-callback'

// Giriş tamamlanamazsa giriş ekranı bu olayla hatayı gösterir
export const NATIVE_AUTH_ERROR = 'native-auth-error'

export async function signInWithGoogleNative() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true }
  })
  if (error) throw error
  await Browser.open({ url: data.url })
}

const fail = (message) => window.dispatchEvent(new CustomEvent(NATIVE_AUTH_ERROR, { detail: message }))

export function setupNativeAuth() {
  if (!isNative || !supabase) return
  App.addListener('appUrlOpen', async ({ url }) => {
    if (!url?.startsWith(NATIVE_AUTH_REDIRECT)) return
    Browser.close().catch(() => {})
    const params = new URL(url).searchParams
    const code = params.get('code')
    if (!code) {
      // Kullanıcı vazgeçti ya da Google / Supabase hata döndürdü
      if (params.get('error')) fail('Google ile giriş tamamlanamadı. Tekrar dene.')
      return
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) fail('Google ile giriş tamamlanamadı. Tekrar dene.')
  })
}
