import { type ReactNode, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  Avatar,
  announce,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  confirm,
  Divider,
  EmptyState,
  ErrorState,
  FlipCard,
  IconButton,
  ListItem,
  LoadingState,
  ProgressBar,
  RadioGroup,
  Screen,
  Sheet,
  Switch,
  Text,
  TextField,
  type ThemePreference,
  toast,
  useTheme,
} from './index'
import { spacing } from './tokens'

/**
 * Écran de démonstration de tous les composants (NON routé) pour valider l'apparence sur appareil,
 * en clair et en sombre. À brancher dans l'écran Diagnostics (`__DEV__`) :
 * `import { Gallery } from '@/ui/Gallery'`.
 */
export function Gallery() {
  const { scheme, preference, setPreference } = useTheme()
  const [sheet, setSheet] = useState(false)
  const [chips, setChips] = useState({ a: true, b: false })
  const [checked, setChecked] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [radio, setRadio] = useState<'private' | 'public'>('private')
  const [progress, setProgress] = useState(40)
  const [text, setText] = useState('Bonjour')
  const [note, setNote] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [selected, setSelected] = useState(false)

  return (
    <Screen scroll padded edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.page}>
        <Text variant="title" accessibilityRole="header">
          Galerie ({scheme})
        </Text>
        <RadioGroup<ThemePreference>
          label="Apparence"
          value={preference}
          onValueChange={setPreference}
          direction="row"
          options={[
            { value: 'system', label: 'Système' },
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
          ]}
        />

        <Section title="Texte">
          <Text variant="display">Display</Text>
          <Text variant="title">Title</Text>
          <Text variant="heading">Heading</Text>
          <Text>Body : le texte courant de l'application.</Text>
          <Text variant="label">Label</Text>
          <Text variant="caption" tone="muted">
            Caption (muted)
          </Text>
          <Text tone="primary">primary</Text>
          <Text tone="destructive">destructive</Text>
          <Text tone="success">success</Text>
          <Text tone="warning">warning</Text>
          <Text tone="info">info</Text>
          <Text monospace>monospace ; ,</Text>
        </Section>

        <Section title="Boutons">
          <Button label="Principal" onPress={() => toast.info('Principal')} />
          <Button label="Secondaire" variant="secondary" onPress={() => {}} />
          <Button label="Contour" variant="outline" icon="plus" onPress={() => {}} />
          <Button label="Discret" variant="ghost" onPress={() => {}} />
          <Button label="Supprimer" variant="destructive" icon="trash-2" onPress={() => {}} />
          <Button label="Petit" size="sm" onPress={() => {}} />
          <Button label="Grand" size="lg" onPress={() => {}} />
          <Button label="Pleine largeur" fullWidth onPress={() => {}} />
          <Button label="Chargement" loading onPress={() => {}} />
          <Button label="Désactivé" disabled onPress={() => {}} />
          <View style={styles.row}>
            <IconButton icon="search" label="Rechercher" onPress={() => {}} />
            <IconButton icon="plus" label="Ajouter" variant="primary" onPress={() => {}} />
            <IconButton icon="trash-2" label="Supprimer" variant="destructive" onPress={() => {}} />
            <IconButton icon="x" label="Fermer" size="sm" variant="outline" onPress={() => {}} />
          </View>
        </Section>

        <Section title="Badges, puces, progression">
          <View style={styles.row}>
            <Badge label="Primaire" tone="primary" />
            <Badge label="Secondaire" />
            <Badge label="Contour" tone="outline" />
            <Badge label="Public" tone="info" icon="globe" />
            <Badge label="Succès" tone="success" />
            <Badge label="Attention" tone="warning" />
            <Badge label="Erreur" tone="destructive" />
          </View>
          <View style={styles.row}>
            <Chip
              label="Tous"
              selected={chips.a}
              count={12}
              onPress={() => setChips((c) => ({ ...c, a: !c.a }))}
            />
            <Chip
              label="Anglais"
              icon="folder"
              selected={chips.b}
              onPress={() => setChips((c) => ({ ...c, b: !c.b }))}
            />
            <Chip label="Désactivée" disabled onPress={() => {}} />
          </View>
          <ProgressBar value={progress} label={`Progression : ${progress} %`} />
          <View style={styles.row}>
            <Button
              label="-10"
              size="sm"
              variant="outline"
              onPress={() => setProgress((p) => Math.max(0, p - 10))}
            />
            <Button
              label="+10"
              size="sm"
              variant="outline"
              onPress={() => setProgress((p) => Math.min(100, p + 10))}
            />
          </View>
        </Section>

        <Section title="Champs">
          <TextField
            label="Titre"
            value={text}
            onChangeText={setText}
            helper="Aide sous le champ"
          />
          <TextField
            label="Recherche"
            labelHidden
            icon="search"
            placeholder="Rechercher…"
            value=""
            onChangeText={() => {}}
            right={<IconButton icon="x" label="Effacer" size="sm" onPress={() => {}} />}
          />
          <TextField
            label="Avec erreur"
            value=""
            onChangeText={() => {}}
            error="Le titre est obligatoire."
          />
          <TextField
            label="Description"
            multiline
            minLines={3}
            maxLength={200}
            showCounter
            value={note}
            onChangeText={setNote}
          />
          <TextField label="Séparateur" monospace value=";" onChangeText={() => {}} />
        </Section>

        <Section title="Choix">
          <Checkbox
            label="Case à cocher"
            description="Texte secondaire"
            checked={checked}
            onCheckedChange={setChecked}
          />
          <Switch
            label="Rappel quotidien"
            description="Tous les jours à 18:00"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
          <RadioGroup
            label="Visibilité"
            value={radio}
            onValueChange={setRadio}
            options={[
              {
                value: 'private',
                label: 'Privé',
                description: 'Visible par vous seul.',
                icon: 'lock',
              },
              { value: 'public', label: 'Public', description: 'Visible par tous.', icon: 'globe' },
            ]}
          />
        </Section>

        <Section title="Lignes, cartes, bandeaux">
          <Card padded={false}>
            <ListItem
              icon="settings"
              title="Paramètres"
              subtitle="Révision et apparence"
              onPress={() => {}}
            />
            <Divider />
            <ListItem icon="folder" title="Dossier courant" selected onPress={() => {}} />
            <Divider />
            <ListItem icon="log-out" title="Se déconnecter" destructive onPress={() => {}} />
          </Card>
          <Card>
            <Text>Carte simple</Text>
          </Card>
          <Card
            onPress={() => setSelected((s) => !s)}
            selected={selected}
            accessibilityLabel="Carte pressable"
          >
            <Text>Carte pressable (appuyer pour sélectionner)</Text>
          </Card>
          <Card tone="success">
            <Text>Réponse juste</Text>
          </Card>
          <Card tone="destructive">
            <Text>Réponse fausse</Text>
          </Card>
          <Banner tone="info" title="Information" description="Un message utile." />
          <Banner tone="warning" title="Hors ligne" description="3 notes en attente." />
          <Banner tone="success" title="Enregistré" />
          <Banner
            tone="destructive"
            title="Session expirée"
            description="Reconnectez-vous pour continuer."
            action={
              <Button label="Se reconnecter" size="sm" variant="outline" onPress={() => {}} />
            }
          />
        </Section>

        <Section title="États">
          <LoadingState rows={2} />
          <ErrorState error={new Error('boom')} onRetry={() => toast.info('Nouvel essai')} />
          <Card>
            <EmptyState
              icon="book-open"
              title="Aucun set"
              description="Créez votre premier set pour commencer."
              action={<Button label="Nouveau set" icon="plus" onPress={() => {}} />}
            />
          </Card>
          <View style={styles.row}>
            <Avatar name="Utilisateur Démo" />
            <Avatar name="alice" size={56} />
          </View>
        </Section>

        <Section title="Carte retournable">
          <FlipCard
            term="Bonjour"
            definition="Hello : salutation courante en anglais."
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
          />
        </Section>

        <Section title="Retours et feuille">
          <View style={styles.row}>
            <Button
              label="Toast"
              variant="secondary"
              size="sm"
              onPress={() => toast.success('Set enregistré.')}
            />
            <Button
              label="Toast erreur"
              variant="secondary"
              size="sm"
              onPress={() => toast.error('Échec.')}
            />
            <Button
              label="Annoncer"
              variant="secondary"
              size="sm"
              onPress={() => announce('Bonne réponse')}
            />
            <Button
              label="Confirmer"
              variant="secondary"
              size="sm"
              onPress={async () => {
                const ok = await confirm({
                  title: 'Supprimer ?',
                  message: 'Action définitive.',
                  confirmLabel: 'Supprimer',
                  destructive: true,
                })
                toast.info(ok ? 'Confirmé' : 'Annulé')
              }}
            />
          </View>
          <Button label="Ouvrir la feuille" onPress={() => setSheet(true)} />
        </Section>
      </View>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Feuille"
        footer={
          <>
            <Button label="Annuler" variant="ghost" onPress={() => setSheet(false)} />
            <Button label="Enregistrer" onPress={() => setSheet(false)} />
          </>
        }
      >
        <TextField label="Nom" value={text} onChangeText={setText} />
        <Text tone="muted">Le clavier ne doit pas cacher le pied.</Text>
      </Sheet>
    </Screen>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.xl },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
})
