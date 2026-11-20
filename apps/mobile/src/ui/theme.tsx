import { type ReactNode, useMemo } from 'react'
import { type ColorScheme, type Colors, lightColors, type ThemePreference } from './tokens'

export interface Theme {
  /** Thème effectivement appliqué (la préférence « système » est résolue). */
  scheme: ColorScheme
  preference: ThemePreference
  colors: Colors
  /**
   * Enregistre la préférence (AsyncStorage `quizlet.theme.v1`) et l'applique avec
   * `Appearance.setColorScheme`. RN 0.88 n'accepte plus `null` : « système » = `'auto'`.
   */
  setPreference: (preference: ThemePreference) => void
}

const DEFAULT_THEME: Theme = {
  scheme: 'light',
  preference: 'system',
  colors: lightColors,
  setPreference: () => {},
}

/**
 * CONTRAT : fournit le thème (clair / sombre). `useTheme()` DOIT fonctionner sans fournisseur
 * (valeurs par défaut claires) : l'`ErrorBoundary` racine s'affiche à la place de tout l'arbre,
 * fournisseurs compris, et utilise `EmptyState` et `Button`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useTheme(): Theme {
  return DEFAULT_THEME
}

/**
 * Styles dépendant du thème, recalculés quand les couleurs changent. `factory` doit être une
 * fonction de MODULE (identité stable) : `const makeStyles = (c: Colors) => StyleSheet.create({…})`.
 */
export function useThemedStyles<T>(factory: (colors: Colors, scheme: ColorScheme) => T): T {
  const { colors, scheme } = useTheme()
  return useMemo(() => factory(colors, scheme), [factory, colors, scheme])
}
