import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Lesson Planner',
        short_name: 'Lessons',
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Supabase calls are cached by the query layer (localStorage persister),
        // so the service worker only needs to own the app shell.
        // /api is the agent connector (a Vercel function), never the app shell.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/api\//],
      },
    }),
  ],
})
