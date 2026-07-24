import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import electron from 'vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5174,
    strictPort: true
  },
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.js',
      },
      {
        entry: 'electron/preload.js',
        onstart(options) {
          options.reload()
        },
      }
    ]),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: "/",
        start_url: "/",
        scope: "/",
        name: "Artories Management Suite",
        short_name: "Artories",
        description: "Suite administrativa para gestión de proyectos y recursos",
        theme_color: "#0a0f1e",
        background_color: "#0a0f1e",
        display: "standalone",
        orientation: "any",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000, // 5MB
        // Forzar recarga si un chunk falla o no se encuentra (ignora URLs que no están en precache, útil para SPA)
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /.*\.js$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'js-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60 // 1 day
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 2500
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/firestore'],
  },
})
