/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// L'API tourne en local sur 127.0.0.1:3000 ; le proxy garde front et API sur la même origine,
// comme en production derrière nginx.
const apiProxy = {
  '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        // Le socle React (chargé dès le départ) dans son propre chunk : il change rarement et
        // reste en cache d'un déploiement à l'autre. Zod, react-hook-form, etc. restent dans
        // les chunks des pages chargées à la demande.
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|@tanstack[\\/][^\\/]+)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: { port: 5180, strictPort: true, proxy: apiProxy },
  preview: { port: 5180, strictPort: true, proxy: apiProxy },
  test: {
    environment: 'node',
    // Logique pure en environnement node ; les tests de rendu déclarent `@vitest-environment jsdom`.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
