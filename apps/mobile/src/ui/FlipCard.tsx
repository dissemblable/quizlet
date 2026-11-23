import { type ComponentProps, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native'
import { faceFontSize, flipAnnouncement } from './logic'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius, spacing } from './tokens'

export interface FlipCardProps {
  term: string
  definition: string
  /** Face visible : `false` = terme, `true` = définition. */
  flipped: boolean
  /** Appui sur la carte. */
  onFlip: () => void
  style?: StyleProp<ViewStyle>
  testID?: string
}

const FLIP_MS = 450
const FADE_MS = 200

/** « Réduire les animations » d'Android, suivi en continu. */
function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled)
      })
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
  return reduceMotion
}

/**
 * CONTRAT : carte retournable (flashcards, révision). Retournement avec `Animated` (rotation), ou
 * fondu si « réduire les animations » est actif (`AccessibilityInfo.isReduceMotionEnabled`). Rôle
 * `button` ; TalkBack lit la face visible.
 *
 * Les deux faces sont masquées à TalkBack : le libellé du bouton (« Terme : … » / « Définition : … »)
 * porte seul le contenu de la face visible. Pas de région live ici : l'écran appelant annonce le
 * changement de face ou de carte (`announce(flipAnnouncement(…))`), un seul canal pour TalkBack.
 */
export function FlipCard({ term, definition, flipped, onFlip, style, testID }: FlipCardProps) {
  const reduceMotion = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(flipped ? 1 : 0))
  const shown = useRef({ term, definition })

  // Layout effect : la bonne face est posée avant la peinture (pas de frame avec la définition de la
  // carte suivante).
  useLayoutEffect(() => {
    const target = flipped ? 1 : 0
    // Autre carte : on saute à la bonne face sans animer, sinon le retour vers le terme
    // laisserait entrevoir la définition de la carte suivante.
    const sameCard = shown.current.term === term && shown.current.definition === definition
    shown.current = { term, definition }
    if (!sameCard) {
      progress.setValue(target)
      return
    }
    const animation = Animated.timing(progress, {
      toValue: target,
      duration: reduceMotion ? FADE_MS : FLIP_MS,
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [flipped, term, definition, reduceMotion, progress])

  const faceStyles = reduceMotion
    ? {
        front: { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
        back: { opacity: progress },
      }
    : {
        // L'opacité bascule à mi-course : on ne compte pas sur `backfaceVisibility`, capricieux
        // sur Android.
        front: {
          opacity: progress.interpolate({
            inputRange: [0, 0.5, 0.5, 1],
            outputRange: [1, 1, 0, 0],
          }),
          transform: [
            { perspective: 1000 },
            {
              rotateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '180deg'],
              }),
            },
          ],
        },
        back: {
          opacity: progress.interpolate({
            inputRange: [0, 0.5, 0.5, 1],
            outputRange: [0, 0, 1, 1],
          }),
          transform: [
            { perspective: 1000 },
            {
              rotateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['180deg', '360deg'],
              }),
            },
          ],
        },
      }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={flipAnnouncement(flipped, term, definition)}
      accessibilityHint="Appuyer pour retourner la carte"
      onPress={onFlip}
      testID={testID}
      style={[styles.root, style]}
    >
      <Face label="Terme" text={term} active={!flipped} animatedStyle={faceStyles.front} />
      <Face label="Définition" text={definition} active={flipped} animatedStyle={faceStyles.back} />
    </Pressable>
  )
}

function Face({
  label,
  text,
  active,
  animatedStyle,
}: {
  label: string
  text: string
  active: boolean
  animatedStyle: ComponentProps<typeof Animated.View>['style']
}) {
  const { colors } = useTheme()
  const size = faceFontSize(text)
  return (
    <Animated.View
      // La face cachée ne doit pas capter les gestes de défilement de la face visible.
      pointerEvents={active ? 'auto' : 'none'}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.face,
        { backgroundColor: colors.card, borderColor: colors.border },
        animatedStyle,
      ]}
    >
      <Text variant="caption" weight="medium" tone="muted" style={styles.faceLabel}>
        {label}
      </Text>
      <ScrollView nestedScrollEnabled contentContainerStyle={styles.faceBody}>
        <Text weight="medium" align="center" style={{ fontSize: size, lineHeight: size * 1.35 }}>
          {text}
        </Text>
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { height: 288 },
  face: {
    ...StyleSheet.absoluteFill,
    gap: spacing.sm,
    padding: spacing.xl,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  faceLabel: { textTransform: 'uppercase', letterSpacing: 0.6 },
  faceBody: { flexGrow: 1, justifyContent: 'center' },
})
