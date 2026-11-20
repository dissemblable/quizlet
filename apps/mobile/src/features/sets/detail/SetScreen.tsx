import { Stack, useRouter } from 'expo-router'
import { memo, useCallback } from 'react'
import { FlatList, type ListRenderItemInfo, StyleSheet, View } from 'react-native'
import { SetGate } from '@/features/common'
import type { SetDetail } from '@/lib/queries'
import { routes } from '@/lib/routes'
import { useIdParam } from '@/lib/use-id-param'
import { Button, EmptyState, Screen, spacing, Text, useTheme } from '@/ui'
import { SetHeader } from './SetHeader'

type SetCard = SetDetail['cards'][number]

/** Détail d'un set (`/sets/[id]`) : méta, modes d'étude, actions et liste des cartes. */
export function SetScreen() {
  const id = useIdParam()
  return <SetGate id={id}>{(set) => <SetOverview set={set} />}</SetGate>
}

const keyExtractor = (card: SetCard) => card.id

function SetOverview({ set }: { set: SetDetail }) {
  const router = useRouter()
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SetCard>) => (
      <CardRow term={item.term} definition={item.definition} />
    ),
    [],
  )

  return (
    <Screen>
      <Stack.Screen options={{ title: set.title }} />
      <FlatList
        data={set.cards}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={<SetHeader set={set} />}
        ListEmptyComponent={
          <EmptyState
            title="Ce set ne contient aucune carte"
            description={set.isOwner ? 'Ajoutez des cartes pour commencer à réviser.' : undefined}
            action={
              set.isOwner ? (
                <Button
                  icon="plus"
                  label="Ajouter des cartes"
                  onPress={() => router.push(routes.editSet(set.id))}
                />
              ) : undefined
            }
          />
        }
        contentContainerStyle={styles.content}
        initialNumToRender={12}
        windowSize={9}
      />
    </Screen>
  )
}

const CardRow = memo(function CardRow({ term, definition }: { term: string; definition: string }) {
  const { colors } = useTheme()
  return (
    <View
      accessible
      accessibilityLabel={`${term}. ${definition}`}
      style={[styles.row, { borderColor: colors.border }]}
    >
      <Text weight="medium">{term}</Text>
      <Text tone="muted">{definition}</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing['2xl'] },
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
