import { defineConfig } from 'tsdown'

export default defineConfig({
  // dist/index.mjs (serveur) et dist/migrate.mjs (commande de migration manuelle).
  entry: { index: 'src/index.ts', migrate: 'src/scripts/migrate.ts' },
  platform: 'node',
  target: 'node24',
  format: 'esm',
  // `exports.types` sert uniquement au front (AppType) : pas de .d.ts à générer.
  dts: false,
  // L'image de prod n'embarque pas de node_modules : tout est inclus dans le bundle.
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  sourcemap: true,
  clean: true,
})
