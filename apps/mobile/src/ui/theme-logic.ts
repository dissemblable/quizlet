import {
  type ColorScheme,
  type Colors,
  darkColors,
  lightColors,
  type ThemePreference,
} from './tokens'

// Logique PURE du thème (testée sous Node) ; `theme.tsx` y branche AsyncStorage et `Appearance`.

/** Clé AsyncStorage de la préférence (la valeur est la chaîne `light`, `dark` ou `system`). */
export const THEME_STORAGE_KEY = 'quizlet.theme.v1'

export const DEFAULT_PREFERENCE: ThemePreference = 'system'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** Valeur lue dans le stockage : tout ce qui n'est pas une préférence connue (absent, corrompu) = système. */
export function parseStoredPreference(raw: string | null | undefined): ThemePreference {
  return isThemePreference(raw) ? raw : DEFAULT_PREFERENCE
}

/** Thème appliqué : « système » suit celui d'Android (clair si Android ne le dit pas). */
export function resolveScheme(
  preference: ThemePreference,
  system: ColorScheme | null | undefined,
): ColorScheme {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light'
  return preference
}

/** Argument d'`Appearance.setColorScheme` : RN 0.88 n'accepte plus `null`, « système » = `'auto'`. */
export function appearanceOverride(preference: ThemePreference): 'light' | 'dark' | 'auto' {
  return preference === 'system' ? 'auto' : preference
}

export function colorsFor(scheme: ColorScheme): Colors {
  return scheme === 'dark' ? darkColors : lightColors
}
