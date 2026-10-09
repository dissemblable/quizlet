// Applique le thème avant le premier rendu pour éviter un flash clair/sombre.
// Fichier externe (et non script inline) pour rester compatible avec la CSP `script-src 'self'`.
// Même logique que src/lib/theme.tsx : clé localStorage « theme » = light | dark | system.
;(() => {
  let theme = 'system'
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') theme = stored
  } catch {
    // Stockage indisponible (navigation privée stricte) : thème du système.
  }
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
})()
