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
  server: { port: 5180, strictPort: true, proxy: apiProxy },
  preview: { port: 5180, strictPort: true, proxy: apiProxy },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
