import type { Rating } from '@quizlet/shared'

// CONTRAT : jetons de thème PURS (aucun import React ni react-native : testables sous Node).
// Hex calculés depuis les jetons oklch de `apps/web/src/index.css` ; conversion oklch vers sRGB
// revérifiée par script : les hex d'origine sont exacts (`destructive` sombre sort à peine du
// gamut sRGB et est écrêté).
//
// Écarts volontaires, imposés par le contraste WCAG (voir `contrast.test.ts`) :
// - `warning` clair `#b45309` devient `#a64a07` : 4,27:1 sur sa surface à 10 % (seuil 4,5:1) ;
// - `info` sombre `#38bdf8` devient `#4ac5fa` : 4,38:1 sur sa surface posée sur une carte ;
// - `outline` (nouveau, absent du web) : contour des contrôles (champ, case, radio, interrupteur,
//   bouton « outline »), au moins 3:1 (WCAG 1.4.11). `border` et `input` gardent les valeurs du web
//   (~1,4:1) : ils ne servent qu'aux filets et aux cartes, décoratifs.

export type ColorScheme = 'light' | 'dark'
/** Préférence de l'utilisateur ; `system` suit le thème d'Android. */
export type ThemePreference = 'light' | 'dark' | 'system'

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 } as const
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 9999 } as const
export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30 } as const

export interface Colors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  primary: string
  primaryForeground: string
  /** Identique à `muted` : fond des éléments secondaires (boutons secondaires, puces). */
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  /** Filets et bordures de cartes (décoratifs, faible contraste comme sur le web). */
  border: string
  /** Fond/bordure discrète du web, conservée pour parité (décorative). */
  input: string
  /** Contour des contrôles interactifs (champ, case, radio, interrupteur) : au moins 3:1. */
  outline: string
  /** Anneau de focus (champ actif). */
  ring: string
  success: string
  warning: string
  info: string
  /** Fonds de bannière / badge : le ton à 10 % d'opacité. */
  successSurface: string
  warningSurface: string
  infoSurface: string
  destructiveSurface: string
  /** Voile derrière une feuille (`Sheet`). */
  overlay: string
}

export const lightColors: Colors = {
  background: '#f1f5fa',
  foreground: '#1a2846',
  card: '#fbfdff',
  cardForeground: '#1a2846',
  primary: '#284cc3',
  primaryForeground: '#f8fafe',
  secondary: '#e1e8f4',
  secondaryForeground: '#1a2846',
  muted: '#e1e8f4',
  mutedForeground: '#58637b',
  accent: '#f7ed6c',
  accentForeground: '#1a2846',
  destructive: '#c51e21',
  destructiveForeground: '#ffffff',
  border: '#cbd5e5',
  input: '#c3cee2',
  outline: '#7a86a1',
  ring: '#3d66df',
  success: '#047857',
  warning: '#a64a07',
  info: '#0369a1',
  successSurface: '#10b9811a',
  warningSurface: '#f59e0b1a',
  infoSurface: '#0ea5e91a',
  destructiveSurface: '#c51e211a',
  overlay: '#00000066',
}

export const darkColors: Colors = {
  background: '#24382f',
  foreground: '#edebe2',
  card: '#2e4239',
  cardForeground: '#edebe2',
  primary: '#f6da6f',
  primaryForeground: '#182b23',
  secondary: '#394d44',
  secondaryForeground: '#edebe2',
  muted: '#394d44',
  mutedForeground: '#b8c1b1',
  accent: '#3e564b',
  accentForeground: '#edebe2',
  destructive: '#ffc3c0',
  destructiveForeground: '#182b23',
  border: '#edebe221',
  input: '#edebe22e',
  outline: '#929f95',
  ring: '#f6da6f',
  success: '#34d399',
  warning: '#fbbf24',
  info: '#4ac5fa',
  successSurface: '#10b9811a',
  warningSurface: '#f59e0b1a',
  infoSurface: '#0ea5e91a',
  destructiveSurface: '#ffc3c01a',
  overlay: '#000000a6',
}

/** Couleur d'une note FSRS : 1 destructive, 2 warning, 3 success, 4 info. */
export function ratingColor(colors: Colors, rating: Rating): string {
  switch (rating) {
    case 1:
      return colors.destructive
    case 2:
      return colors.warning
    case 3:
      return colors.success
    case 4:
      return colors.info
  }
}
