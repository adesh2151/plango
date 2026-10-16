import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Live data (exchange rates, countries, visa, places, flights) is
        // runtime-cached as it is fetched so the app keeps working offline
        // with the last-seen values. The app shell is precached.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/open\.er-api\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fx-rates', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } },
          },
          {
            // mledoze/countries + passport-index matrix (reference data)
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'reference-data', expiration: { maxEntries: 20, maxAgeSeconds: 2592000 } },
          },
          {
            urlPattern: /^https:\/\/flagcdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'flags', expiration: { maxEntries: 300, maxAgeSeconds: 2592000 } },
          },
          {
            urlPattern: /^https:\/\/([a-z]+\.)?wikipedia\.org\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'wiki', expiration: { maxEntries: 200, maxAgeSeconds: 604800 } },
          },
          {
            urlPattern: /^https:\/\/upload\.wikimedia\.org\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'wiki-img', expiration: { maxEntries: 200, maxAgeSeconds: 604800 } },
          },
          {
            urlPattern: /^https:\/\/(geocoding-api\.open-meteo\.com|overpass[.-])/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'places', expiration: { maxEntries: 100, maxAgeSeconds: 604800 } },
          },
          {
            urlPattern: /^https:\/\/en\.wikivoyage\.org\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'wikivoyage', expiration: { maxEntries: 100, maxAgeSeconds: 604800 } },
          },
        ],
      },
      manifest: {
        name: 'PlanGo',
        short_name: 'PlanGo',
        description:
          'Plan it, then go. Itinerary, budget & who-paid splitting, favourite places, and live visa, currency & exchange info.',
        lang: 'en',
        theme_color: '#0e7490',
        background_color: '#f0fbff',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
})
