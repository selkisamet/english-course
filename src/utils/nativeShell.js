// Telefon uygulamasının (Capacitor) sisteme bağlı davranışları

import { registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative } from './platform'

// Telefonun açık / karanlık teması (android/.../SystemThemePlugin.java).
// Android'in uygulama içi tarayıcısı prefers-color-scheme'i güvenilir iletmediği için
// tema html[data-theme] ile uygulanır (global.css).
const SystemTheme = registerPlugin('SystemTheme')

function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  // Durum çubuğu simgeleri: açık temada koyu, karanlık temada açık
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
}

export function setupNativeShell() {
  if (!isNative) return

  // Android geri tuşu: uygulama içinde bir önceki sayfa; ana sayfada uygulamadan çık
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && window.location.pathname !== '/') window.history.back()
    else App.exitApp()
  })

  SystemTheme.get()
    .then(({ dark }) => applyTheme(dark))
    .catch(() => {})
  SystemTheme.addListener('change', ({ dark }) => applyTheme(dark))
}
