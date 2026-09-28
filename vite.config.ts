import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/anatomy-trainer/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Lab Practical Trainer',
        short_name: 'A&P Lab',
        description: 'Study app for the A&P I lab practical',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#F3F5F2',
        theme_color: '#F2B705',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: /\/img\/.*\.webp$/,
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
});
