import { errorMessage, LIMITS } from '@quizlet/shared'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useDebouncedValue } from '@/lib/hooks'
import { parseSetReference } from '@/lib/links'
import { useSearchSets } from '@/lib/queries'
import { queryView } from '@/lib/query-state'
import { routes } from '@/lib/routes'
import { announce, IconButton, ListItem, Screen, spacing, Text, TextField } from '@/ui'
import {
  noResultMessage,
  referenceLabel,
  resultSubtitle,
  SEARCH_HINT,
  SEARCH_LABEL,
  SEARCH_OFFLINE,
  SEARCH_PENDING,
  SEARCH_PLACEHOLDER,
  type SearchOutcome,
  searchAnnouncement,
} from './search-text'

/**
 * Recherche globale dans mes sets (titre, description, tags, cartes). Accepte aussi un lien
 * `…/sets/<uuid>` ou un UUID : le web n'a pas de listing de sets publics, on les ouvre par lien.
 */
export function SearchScreen() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const trimmed = input.trim()
  const reference = parseSetReference(trimmed)
  const debounced = useDebouncedValue(trimmed)
  // Un lien n'est pas un texte à chercher ; un champ vidé ne doit pas garder ses anciens résultats.
  const search = reference !== null || trimmed === '' ? '' : debounced
  const results = useSearchSets(search)

  const showResults = search !== '' && !results.isError && results.data !== undefined
  const found = showResults ? (results.data?.sets ?? []) : []
  // Les résultats d'une saisie plus ancienne (anti-rebond, placeholder) ne doivent pas être ouverts.
  const upToDate = !results.isPlaceholderData && search === trimmed
  const first = upToDate ? found[0] : undefined

  const outcome: SearchOutcome = results.isError
    ? { kind: 'error', error: results.error }
    : results.data !== undefined && !results.isPlaceholderData
      ? { kind: 'done', total: results.data.total }
      : { kind: 'pending' }
  const announcement = searchAnnouncement(search, outcome)
  useEffect(() => {
    if (announcement) announce(announcement)
  }, [announcement])

  function open(id: string) {
    router.push(routes.set(id))
  }

  function onSubmit() {
    const id = reference ?? first?.id
    if (id) open(id)
  }

  return (
    <Screen padded>
      <TextField
        label={SEARCH_LABEL}
        labelHidden
        placeholder={SEARCH_PLACEHOLDER}
        value={input}
        onChangeText={setInput}
        maxLength={LIMITS.search}
        icon="search"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={onSubmit}
        right={
          input === '' ? undefined : (
            <IconButton
              icon="x"
              size="sm"
              label="Effacer la recherche"
              onPress={() => setInput('')}
            />
          )
        }
      />
      <FlatList
        data={found}
        keyExtractor={(set) => set.id}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Résultats"
        style={results.isFetching ? styles.busy : undefined}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          reference === null ? undefined : (
            <ListItem
              icon="link"
              title={referenceLabel(reference)}
              onPress={() => open(reference)}
              accessibilityHint="Ouvre ce set s'il est à vous ou public"
            />
          )
        }
        ListEmptyComponent={
          <View style={styles.message}>
            <Message
              search={search}
              hasReference={reference !== null}
              error={results.isError ? results.error : null}
              offline={results.data === undefined && queryView(results) === 'offline'}
              pending={results.data === undefined || results.isPlaceholderData}
            />
          </View>
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.title}
            subtitle={resultSubtitle(item.cardCount, item.tags)}
            onPress={() => open(item.id)}
          />
        )}
      />
    </Screen>
  )
}

/** Message affiché quand il n'y a aucun résultat à montrer, dans l'ordre de priorité du web. */
function Message({
  search,
  hasReference,
  error,
  offline,
  pending,
}: {
  search: string
  hasReference: boolean
  error: unknown
  offline: boolean
  pending: boolean
}) {
  if (search === '') return hasReference ? null : <Text tone="muted">{SEARCH_HINT}</Text>
  if (error !== null) return <Text tone="destructive">{errorMessage(error)}</Text>
  if (offline) return <Text tone="muted">{SEARCH_OFFLINE}</Text>
  if (pending) return <Text tone="muted">{SEARCH_PENDING}</Text>
  return <Text tone="muted">{noResultMessage(search)}</Text>
}

const styles = StyleSheet.create({
  busy: { opacity: 0.6 },
  list: { paddingTop: spacing.md },
  message: { paddingVertical: spacing.sm },
})
