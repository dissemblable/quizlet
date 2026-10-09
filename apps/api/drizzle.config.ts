import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://quizlet:quizlet@127.0.0.1:5433/quizlet',
  },
  strict: true,
  verbose: true,
})
