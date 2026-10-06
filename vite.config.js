import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Yeni sürüm hazır olunca kullanıcıya sorulur; çalışma yarıda kesilmesin
      registerType: 'prompt',
      // public/manifest.webmanifest kullanılır
      manifest: false,
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Kelime işaretlemeleri ve ses zamanlamaları: yeni hazırlanmış ya da düzeltilmiş olanı
            // hemen göster, çevrimdışıyken önbellekteki kullanılır
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /^\/api\/stories\/[^/]+\/(annotations|audio)$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'annotations', networkTimeoutSeconds: 4 }
          },
          {
            // Hikayeler: önbellekten hemen göster, arka planda güncelle
            urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/stories'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'stories' }
          },
          {
            // Kelime listesi ve kelime detayları
            urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/vocabulary/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'vocabulary', expiration: { maxEntries: 4000 } }
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' }
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
