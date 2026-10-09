// Préchargé (`--import`) par les scripts pnpm de dev uniquement, jamais dans l'image de prod.
// Ordre de priorité : variables du shell, puis `.env` (surcharges locales), puis `.env.development`.
// process.loadEnvFile n'écrase pas une variable déjà définie : le premier fichier chargé l'emporte.
import { existsSync } from 'node:fs'

for (const file of ['.env', '.env.development']) {
  if (existsSync(file)) process.loadEnvFile(file)
}
