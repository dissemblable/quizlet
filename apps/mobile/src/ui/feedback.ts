import { AccessibilityInfo, Alert, ToastAndroid } from 'react-native'
import { shortenToast } from './logic'

/**
 * Retours brefs (`ToastAndroid`, lus par TalkBack). `SHORT` dure ~2 s, `LONG` ~3,5 s : le système
 * coupe un message trop long, alors garder des phrases courtes (tronquées à 120 caractères ici).
 * Les erreurs restent plus longtemps.
 */
export const toast = {
  success: (message: string) => ToastAndroid.show(shortenToast(message), ToastAndroid.SHORT),
  info: (message: string) => ToastAndroid.show(shortenToast(message), ToastAndroid.SHORT),
  error: (message: string) => ToastAndroid.show(shortenToast(message), ToastAndroid.LONG),
}

/** Annonce `message` aux lecteurs d'écran (TalkBack) sans rien afficher. */
export function announce(message: string): void {
  if (message.trim() === '') return
  AccessibilityInfo.announceForAccessibility(message)
}

export interface ConfirmOptions {
  title: string
  message?: string
  /** Défaut : « Confirmer ». */
  confirmLabel?: string
  /** Défaut : « Annuler ». */
  cancelLabel?: string
  /**
   * Bouton de confirmation en rouge (suppressions). Sans effet sur Android : `Alert` ignore le
   * style `destructive`, le libellé doit donc dire l'action (« Supprimer »).
   */
  destructive?: boolean
}

/** Demande confirmation (`Alert.alert`). Résout `false` sur Annuler, Retour ou clic à côté. */
export function confirm({
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}
