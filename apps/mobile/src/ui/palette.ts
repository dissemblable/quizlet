import type { BadgeTone } from './Badge'
import type { ButtonVariant } from './Button'
import type { CardTone } from './Card'
import { composite, withAlpha } from './contrast'
import type { TextTone } from './Text'
import type { Colors } from './tokens'

// Choix de couleurs des composants : fonctions PURES de `Colors`, pour que `palette.test.ts`
// vérifie le contraste de ce qui est réellement affiché (pas seulement des paires de jetons).

export interface SurfaceColors {
  /** `transparent` : le fond du parent reste visible. */
  background: string
  foreground: string
  border: string
}

export function buttonColors(
  colors: Colors,
  variant: ButtonVariant,
): SurfaceColors & { pressedBackground: string } {
  switch (variant) {
    case 'primary':
      return {
        background: colors.primary,
        foreground: colors.primaryForeground,
        border: 'transparent',
        pressedBackground: colors.primary,
      }
    case 'secondary':
      return {
        background: colors.secondary,
        foreground: colors.secondaryForeground,
        border: 'transparent',
        pressedBackground: colors.secondary,
      }
    case 'outline':
      return {
        background: 'transparent',
        foreground: colors.foreground,
        border: colors.outline,
        pressedBackground: colors.muted,
      }
    case 'ghost':
      return {
        background: 'transparent',
        foreground: colors.foreground,
        border: 'transparent',
        pressedBackground: colors.muted,
      }
    case 'destructive':
      return {
        background: colors.destructiveSurface,
        foreground: colors.destructive,
        border: 'transparent',
        pressedBackground: colors.destructiveSurface,
      }
  }
}

export function textColor(colors: Colors, tone: TextTone): string {
  switch (tone) {
    case 'default':
      return colors.foreground
    case 'muted':
      return colors.mutedForeground
    case 'primary':
      return colors.primary
    case 'destructive':
      return colors.destructive
    case 'success':
      return colors.success
    case 'warning':
      return colors.warning
    case 'info':
      return colors.info
    case 'inverse':
      return colors.primaryForeground
  }
}

export type StatusTone = 'info' | 'warning' | 'success' | 'destructive'

/** Texte et fond (le ton à 10 %) d'un bandeau ou d'un badge d'état. */
export function statusColors(colors: Colors, tone: StatusTone): SurfaceColors {
  switch (tone) {
    case 'info':
      return { background: colors.infoSurface, foreground: colors.info, border: colors.info }
    case 'warning':
      return {
        background: colors.warningSurface,
        foreground: colors.warning,
        border: colors.warning,
      }
    case 'success':
      return {
        background: colors.successSurface,
        foreground: colors.success,
        border: colors.success,
      }
    case 'destructive':
      return {
        background: colors.destructiveSurface,
        foreground: colors.destructive,
        border: colors.destructive,
      }
  }
}

export function badgeColors(colors: Colors, tone: BadgeTone): SurfaceColors {
  switch (tone) {
    case 'primary':
      return {
        background: colors.primary,
        foreground: colors.primaryForeground,
        border: 'transparent',
      }
    case 'secondary':
      return {
        background: colors.secondary,
        foreground: colors.secondaryForeground,
        border: 'transparent',
      }
    case 'outline':
      return { background: 'transparent', foreground: colors.foreground, border: colors.border }
    default:
      return { ...statusColors(colors, tone), border: 'transparent' }
  }
}

export interface CardColors {
  /** Opaque : la teinte est déjà posée sur `colors.card`. */
  background: string
  border: string
  borderWidth: 1 | 2
}

export function cardColors(colors: Colors, tone: CardTone, selected: boolean): CardColors {
  const effective: CardTone = tone === 'default' && selected ? 'primary' : tone
  switch (effective) {
    case 'default':
      return { background: colors.card, border: colors.border, borderWidth: 1 }
    case 'primary':
      return {
        background: composite(withAlpha(colors.primary, 0.08), colors.card),
        border: colors.primary,
        borderWidth: 2,
      }
    case 'success':
      return {
        background: composite(colors.successSurface, colors.card),
        border: colors.success,
        borderWidth: 2,
      }
    case 'destructive':
      return {
        background: composite(colors.destructiveSurface, colors.card),
        border: colors.destructive,
        borderWidth: 2,
      }
  }
}
