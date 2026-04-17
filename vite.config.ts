import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // `createWebHistory` means every route must be served by
        // `index.html`; without this, hard-navigations to
        // `/auth/callback` (or any client-side route) would 404 when
        // the PWA is offline.
        navigateFallback: '/index.html',
        // Don't catch real asset or API requests with the SPA fallback.
        navigateFallbackDenylist: [/^\/assets\//, /\.[^/]+$/],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'Strava Activity Map',
        short_name: 'StravaMap',
        description: 'View your Strava activities on an interactive map',
        theme_color: '#fc4c02',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          // A single SVG covers every size — Chrome/Edge/Firefox all
          // accept `sizes: "any"` on vector icons. We also flag it as
          // maskable so Android can apply its adaptive-icon mask.
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
