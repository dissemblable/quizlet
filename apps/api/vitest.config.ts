import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    // Les tests partagent une seule base Postgres : exécution des fichiers en série.
    fileParallelism: false,
  },
})
