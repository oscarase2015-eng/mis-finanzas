import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  // En GitHub Pages la app vive en /<repositorio>/
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    mode === 'single'
      ? viteSingleFile()
      : VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg'],
          workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
          manifest: {
            name: 'Mis Finanzas',
            short_name: 'Finanzas',
            description: 'Finanzas personales en lempiras y dólares',
            lang: 'es',
            theme_color: '#f4f4f4',
            background_color: '#f4f4f4',
            display: 'standalone',
            start_url: './',
            scope: './',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
        }),
  ],
  build: mode === 'single' ? { outDir: 'dist-single' } : {},
}));
