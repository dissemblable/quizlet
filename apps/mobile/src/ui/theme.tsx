import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Appearance, useColorScheme } from 'react-native'
import {
  appearanceOverride,
  colorsFor,
  DEFAULT_PREFERENCE,
  parseStoredPreference,
  resolveScheme,
  THEME_STORAGE_KEY,
} from './theme-logic'
import type { ColorScheme, Colors, ThemePreference } from './tokens'

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

function fallbackTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    preference: DEFAULT_PREFERENCE,
    colors: colorsFor(scheme),
    setPreference: () => {},
  }
}

const FALLBACKS: Record<ColorScheme, Theme> = {
  light: fallbackTheme('light'),
  dark: fallbackTheme('dark'),
}

const ThemeContext = createContext<Theme | null>(null)

function applyOverride(preference: ThemePreference): void {
  try {
    Appearance.setColorScheme(appearanceOverride(preference))
  } catch {
    // Le thème de l'app suit déjà la préférence en mémoire : seul le thème natif (barres) manque.
  }
}

/**
 * CONTRAT : fournit le thème (clair / sombre). `useTheme()` DOIT fonctionner sans fournisseur :
 * l'`ErrorBoundary` racine s'affiche à la place de tout l'arbre, fournisseurs compris, et utilise
 * `EmptyState` et `Button`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_PREFERENCE)
  // Un choix fait avant la fin de la lecture du stockage ne doit pas être écrasé par elle.
  const chosen = useRef(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const stored = parseStoredPreference(await AsyncStorage.getItem(THEME_STORAGE_KEY))
        if (!active || chosen.current) return
        setPreferenceState(stored)
        applyOverride(stored)
      } catch {
        // Stockage illisible : thème du système.
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    chosen.current = true
    setPreferenceState(next)
    applyOverride(next)
    // Écriture impossible (erreur synchrone ou rejet) : le choix vaut pour la session.
    try {
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {})
    } catch {}
  }, [])

  const scheme = resolveScheme(preference, system)
  const value = useMemo<Theme>(
    () => ({ scheme, preference, colors: colorsFor(scheme), setPreference }),
    [scheme, preference, setPreference],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Sans fournisseur (ErrorBoundary racine) : thème du système, clair si Android ne le dit pas,
 * `setPreference` sans effet.
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext)
  const system = useColorScheme()
  return theme ?? FALLBACKS[resolveScheme('system', system)]
}

/**
 * Styles dépendant du thème, recalculés quand les couleurs changent. `factory` doit être une
 * fonction de MODULE (identité stable) : `const makeStyles = (c: Colors) => StyleSheet.create({…})`.
 */
export function useThemedStyles<T>(factory: (colors: Colors, scheme: ColorScheme) => T): T {
  const { colors, scheme } = useTheme()
  return useMemo(() => factory(colors, scheme), [factory, colors, scheme])
}
