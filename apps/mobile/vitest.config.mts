import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Logique pure uniquement : pas de react-native dans Node.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // `config.ts` lève une erreur sans ces variables : toute suite qui l'importe, même
    // indirectement, planterait.
    env: {
      EXPO_PUBLIC_API_URL: 'https://quizlet.example.com',
      EXPO_PUBLIC_AUTH_URL: 'https://auth.example.com',
      EXPO_PUBLIC_OIDC_CLIENT_ID: 'quizlet-mobile',
    },
  },
})
