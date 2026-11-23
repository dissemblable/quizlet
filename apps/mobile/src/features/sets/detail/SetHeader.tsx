import { pluralize } from '@quizlet/shared'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { VisibilityBadge } from '@/features/common'
import type { SetDetail } from '@/lib/queries'
import { routes } from '@/lib/routes'
import { Button, type IconName, spacing, Text } from '@/ui'
import { StudyModeTile } from './StudyModeTile'
import { createdByLabel, tagsLabel } from './set-meta'
import { type StudyModeKey, studyModes } from './study-modes'
import { useSetActions } from './use-set-actions'

const STUDY_ICONS: Record<StudyModeKey, IconName> = {
  review: 'repeat',
  flashcards: 'layers',
  quiz: 'list',
  write: 'edit-3',
}

const STUDY_ROUTES: Record<StudyModeKey, (id: string) => string> = {
  review: routes.reviewSet,
  flashcards: routes.flashcards,
  quiz: routes.quiz,
  write: routes.write,
}

/** En-tête de la liste : méta, titre, description, modes d'étude, actions, titre « Cartes (N) ». */
export function SetHeader({ set }: { set: SetDetail }) {
  const router = useRouter()
  const actions = useSetActions(set)
  const createdBy = createdByLabel(set)
  const tags = tagsLabel(set.tags)

  return (
    <View style={styles.root}>
      <View style={styles.meta}>
        <VisibilityBadge visibility={set.visibility} />
        <Text variant="label" tone="muted">
          {pluralize(set.cards.length, 'carte')}
        </Text>
        {createdBy ? (
          <Text variant="label" tone="muted">
            {createdBy}
          </Text>
        ) : null}
        {tags ? (
          <Text variant="label" tone="muted" accessibilityLabel={`Tags : ${tags}`}>
            {tags}
          </Text>
        ) : null}
      </View>

      <Text variant="title" weight="semibold" accessibilityRole="header">
        {set.title}
      </Text>
      {set.description ? <Text tone="muted">{set.description}</Text> : null}

      <View style={styles.tiles}>
        {studyModes(set.cards).map((mode) => (
          <StudyModeTile
            key={mode.key}
            icon={STUDY_ICONS[mode.key]}
            title={mode.title}
            description={mode.description}
            unavailableReason={mode.unavailableReason}
            onPress={() => router.push(STUDY_ROUTES[mode.key](set.id))}
          />
        ))}
      </View>

      <View style={styles.actions}>
        {set.isOwner ? (
          <Button
            variant="outline"
            icon="edit-2"
            label="Modifier"
            onPress={() => router.push(routes.editSet(set.id))}
          />
        ) : null}
        <Button
          variant="outline"
          icon="copy"
          label="Dupliquer"
          loading={actions.duplicating}
          onPress={actions.duplicateSet}
        />
        {set.visibility === 'public' ? (
          <Button variant="outline" icon="link" label="Copier le lien" onPress={actions.copyLink} />
        ) : null}
        {set.isOwner ? (
          <Button
            variant="outline"
            icon="upload"
            label="Importer des cartes"
            onPress={() => router.push(routes.importInto(set.id))}
          />
        ) : null}
        {set.isOwner ? (
          <Button
            variant="destructive"
            icon="trash-2"
            label="Supprimer"
            loading={actions.deleting}
            onPress={actions.removeSet}
          />
        ) : null}
      </View>

      <Text variant="heading" weight="semibold" accessibilityRole="header" style={styles.cards}>
        Cartes{' '}
        <Text variant="heading" weight="regular" tone="muted">
          ({set.cards.length})
        </Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  tiles: { gap: spacing.md, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cards: { marginTop: spacing.lg },
})
