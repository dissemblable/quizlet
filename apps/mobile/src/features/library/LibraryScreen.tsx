import { LIMITS, type LibraryFilters, pluralize } from '@quizlet/shared'
import { useRouter } from 'expo-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useDebouncedValue } from '@/lib/hooks'
import { type SetSummary, useFolders, useSets, useTags } from '@/lib/queries'
import { queryView } from '@/lib/query-state'
import { routes } from '@/lib/routes'
import { useEffectiveSummary, useIsOnline } from '@/offline'
import {
  announce,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  spacing,
  Text,
  TextField,
  toast,
  useTheme,
} from '@/ui'
import { FilterBar } from './FilterBar'
import { applyFilterPatch, INITIAL_FILTERS, isFiltered, pageCount } from './filters'
import { LibraryEmpty } from './LibraryEmpty'
import { MoveSetSheet } from './MoveSetSheet'
import { pageLabel, resultsAnnouncement } from './messages'
import { ReviewBanner } from './ReviewBanner'
import { SetCard } from './SetCard'

/** Onglet Bibliothèque : mes sets (recherche, dossiers, tags, pagination), bandeau de révision. */
export function LibraryScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const online = useIsOnline()
  const [input, setInput] = useState('')
  const search = useDebouncedValue(input.trim())
  const [filters, setFilters] = useState<LibraryFilters>(INITIAL_FILTERS)
  const [moving, setMoving] = useState<SetSummary | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const listRef = useRef<FlatList<SetSummary>>(null)
  const announced = useRef<unknown>(null)

  const query = useSets(filters)
  const folders = useFolders()
  const tags = useTags()
  const summary = useEffectiveSummary()
  const data = query.data
  const pages = data ? pageCount(data.total, data.pageSize) : 1

  // La recherche débattue rejoint les filtres, et la liste repart de la première page.
  useEffect(() => {
    setFilters((current) =>
      current.q === search ? current : applyFilterPatch(current, { q: search }),
    )
  }, [search])

  // Annonce le nombre de résultats une fois par jeu de données reçu, hors affichage initial.
  useEffect(() => {
    if (!data || query.isPlaceholderData || announced.current === data) return
    announced.current = data
    if (filters.q || isFiltered(filters)) announce(resultsAnnouncement(data.total))
  }, [data, query.isPlaceholderData, filters])

  function update(patch: Partial<LibraryFilters>) {
    setFilters((current) => applyFilterPatch(current, patch))
    if (patch.page) listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }

  async function refresh() {
    // Hors ligne, un rafraîchissement resterait en pause : on ne fait pas tourner le cercle.
    if (!online) {
      toast.info("Hors ligne : impossible d'actualiser.")
      return
    }
    setRefreshing(true)
    try {
      await Promise.all([query.refetch(), folders.refetch(), tags.refetch(), summary.refetch()])
    } finally {
      setRefreshing(false)
    }
  }

  let empty: ReactNode
  if (data !== undefined) {
    empty = (
      <LibraryEmpty
        filters={filters}
        onClearSearch={() => setInput('')}
        onResetFilters={() => update({ folder: undefined, tags: [] })}
        onCreate={() => router.push(routes.newSet)}
      />
    )
  } else {
    const view = queryView(query)
    if (view === 'offline') {
      empty = (
        <EmptyState
          icon="wifi-off"
          title="Données indisponibles hors ligne"
          description="Ce contenu n'a pas encore été chargé sur cet appareil."
        />
      )
    } else if (view === 'error') {
      empty = <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    } else {
      empty = <LoadingState label="Chargement de la bibliothèque…" rows={3} />
    }
  }

  const header = (
    <View style={styles.header}>
      <View>
        <Text variant="title" weight="semibold" accessibilityRole="header">
          Ma bibliothèque
        </Text>
        {data && !filters.q ? (
          <Text variant="label" tone="muted">
            {pluralize(data.total, 'set')}
          </Text>
        ) : null}
      </View>
      <TextField
        label="Rechercher dans mes sets"
        labelHidden
        placeholder="Rechercher un set…"
        icon="search"
        value={input}
        onChangeText={setInput}
        maxLength={LIMITS.search}
        returnKeyType="search"
        autoCorrect={false}
        right={
          input !== '' ? (
            <IconButton
              icon="x"
              size="sm"
              label="Effacer le champ de recherche"
              onPress={() => setInput('')}
            />
          ) : undefined
        }
      />
      <ReviewBanner summary={summary.data} onReview={() => router.navigate(routes.review)} />
      <FilterBar filters={filters} folders={folders.data} tags={tags.data} onChange={update} />
    </View>
  )

  const footer =
    pages > 1 ? (
      <View style={styles.pager}>
        <Button
          label="Précédente"
          variant="outline"
          disabled={filters.page <= 1}
          onPress={() => update({ page: filters.page - 1 })}
        />
        <Text variant="label" tone="muted" accessibilityLiveRegion="polite">
          {pageLabel(filters.page, pages)}
        </Text>
        <Button
          label="Suivante"
          variant="outline"
          disabled={filters.page >= pages}
          onPress={() => update({ page: filters.page + 1 })}
        />
      </View>
    ) : undefined

  return (
    <Screen>
      <FlatList
        ref={listRef}
        data={data?.sets ?? []}
        keyExtractor={(set) => set.id}
        renderItem={({ item }) => (
          <SetCard
            set={item}
            dimmed={query.isPlaceholderData}
            onOpen={() => router.push(routes.set(item.id))}
            onMove={() => setMoving(item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        accessibilityState={{ busy: query.isPlaceholderData }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      />
      <MoveSetSheet set={moving} folders={folders.data} onClose={() => setMoving(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, flexGrow: 1 },
  header: { gap: spacing.lg, marginBottom: spacing.lg },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
})
