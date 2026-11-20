import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { ListItem, Sheet, spacing, Text, TextField } from '@/ui'
import { filterTimeZones, zoneLabel } from './time-zone-filter'

interface TimeZoneFieldProps {
  label: string
  helper: string
  value: string
  onChange: (zone: string) => void
  /** Fuseaux proposés (`listTimeZones`), `value` compris. */
  zones: readonly string[]
  error?: string
}

/** Fuseau horaire : une ligne qui ouvre une feuille avec recherche (pas de `<select>` sur mobile). */
export function TimeZoneField({
  label,
  helper,
  value,
  onChange,
  zones,
  error,
}: TimeZoneFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => filterTimeZones(zones, query), [zones, query])

  function close() {
    setOpen(false)
    setQuery('')
  }

  return (
    <View style={styles.field}>
      <Text variant="label" weight="medium">
        {label}
      </Text>
      <ListItem
        icon="globe"
        title={zoneLabel(value)}
        accessibilityLabel={`${label} : ${zoneLabel(value)}`}
        accessibilityHint="Ouvre la liste des fuseaux horaires"
        onPress={() => setOpen(true)}
      />
      {error ? (
        <Text variant="caption" tone="destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : (
        <Text variant="caption" tone="muted">
          {helper}
        </Text>
      )}
      <Sheet visible={open} onClose={close} title={label} fullHeight scroll={false}>
        <TextField
          label="Rechercher un fuseau horaire"
          labelHidden
          placeholder="Rechercher (Paris, New York…)"
          value={query}
          onChangeText={setQuery}
          icon="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FlatList
          data={shown}
          keyExtractor={(zone) => zone}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          ListEmptyComponent={
            <Text tone="muted" style={styles.empty}>
              Aucun fuseau ne correspond à « {query.trim()} ».
            </Text>
          }
          renderItem={({ item }) => (
            <ListItem
              title={zoneLabel(item)}
              selected={item === value}
              showChevron={false}
              onPress={() => {
                onChange(item)
                close()
              }}
            />
          )}
        />
      </Sheet>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  empty: { paddingVertical: spacing.lg },
})
