import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // The commit this build came from (Vercel sets it), shown in Settings so
  // "which version am I running?" has a one-look answer.
  define: {
    __BUILD__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Private Chess Lesson Planner',
        short_name: 'Lesson Planner',
        description: 'Private chess lesson planner — build puzzles, present them at the board.',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f3ef',
        theme_color: '#f4f3ef',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,ico,woff2}'],
        // The display fonts come from Google; keep a copy so the skins look
        // the same with no connection.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css', expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: 'index.html',
        // Supabase calls are cached by the query layer (localStorage persister),
        // so the service worker only needs to own the app shell.
        // /api is the agent connector (a Vercel function), never the app shell.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/api\//],
      },
    }),
  ],
})
