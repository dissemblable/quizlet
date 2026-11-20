import {
  buildWriteQuestions,
  errorMessage,
  initWrite,
  isWriteCorrect,
  type WriteOptions,
  type WriteQuestion,
  type WriteState,
  writeReducer,
  writeScoreOf,
} from '@quizlet/shared'
import { Stack } from 'expo-router'
import { useEffect, useReducer, useRef, useState } from 'react'
import { Keyboard, StyleSheet, type TextInput, type TextInputInstance, View } from 'react-native'
import { SetGate } from '@/features/common'
import { type SetDetail, useDueCardIds } from '@/lib/queries'
import { useIdParam } from '@/lib/use-id-param'
import { useIsOnline } from '@/offline'
import { Button, Card, Checkbox, RadioGroup, Screen, spacing, Text, TextField } from '@/ui'
import { BackToSetButton } from './BackToSetButton'
import { NoCards } from './NoCards'
import { correctCountLabel, percentOf, questionAnnouncement, questionPosition } from './result-text'
import { ScoreResult } from './ScoreResult'
import { SessionProgress } from './SessionProgress'
import { useAnnounce } from './use-announce'
import {
  DUE_OFFLINE_HINT,
  DUE_OPTION_LABEL,
  dueStatus,
  selectWritePool,
  startLabel,
} from './write-pool'
import {
  answerFieldLabel,
  canOverride,
  continueLabel,
  promptLabel,
  WRITE_DIRECTIONS,
  writeFeedback,
  writeFeedbackAnnouncement,
  writeMistakeRows,
  writeStatement,
} from './write-text'

// CONTRAT : `TextField.inputRef` est typé `Ref<TextInput>` ; sous RN 0.88 ce type (`TextInputType`)
// n'a pas `focus`, que porte l'instance réelle (`TextInputInstance`). À corriger dans `ui/TextField`.
const focusInput = (field: TextInput | null) =>
  (field as unknown as TextInputInstance | null)?.focus()

/** Mode écrit d'un set : aucune écriture serveur, sans effet sur la planification FSRS. */
export function WriteScreen() {
  const id = useIdParam()
  return (
    <SetGate id={id}>
      {(set) =>
        set.cards.length === 0 ? <NoCards setId={set.id} /> : <WriteMode key={set.id} set={set} />
      }
    </SetGate>
  )
}

function WriteMode({ set }: { set: SetDetail }) {
  const [options, setOptions] = useState<WriteOptions>({ direction: 'term', shuffle: false })
  const [onlyDue, setOnlyDue] = useState(false)
  // « À revoir » : cartes dues aujourd'hui selon FSRS, lues sans modifier la planification. Il
  // faut une connexion : hors ligne l'option est désactivée et ignorée.
  const online = useIsOnline()
  const dueActive = onlyDue && online
  const due = useDueCardIds(set.id, dueActive)
  const pool = selectWritePool(set.cards, due.data, dueActive)
  // Un nouveau tirage (ordre, sens) à chaque départ ; `round` remonte la session.
  const [session, setSession] = useState<{ round: number; questions: WriteQuestion[] } | null>(null)

  function start() {
    setSession((previous) => ({
      round: (previous?.round ?? 0) + 1,
      questions: buildWriteQuestions(pool, options),
    }))
  }

  return (
    <>
      <Stack.Screen options={{ title: `Mode écrit · ${set.title}` }} />
      {session ? (
        <WriteSession
          key={session.round}
          setId={set.id}
          questions={session.questions}
          onRestart={start}
          onChangeOptions={() => setSession(null)}
        />
      ) : (
        <WriteSetup
          options={options}
          onChange={setOptions}
          onlyDue={dueActive}
          onOnlyDueChange={setOnlyDue}
          online={online}
          loadingDue={dueActive && due.isPending}
          dueError={dueActive && due.isError ? errorMessage(due.error) : null}
          count={pool.length}
          onStart={start}
        />
      )}
    </>
  )
}

function WriteSetup({
  options,
  onChange,
  onlyDue,
  onOnlyDueChange,
  online,
  loadingDue,
  dueError,
  count,
  onStart,
}: {
  options: WriteOptions
  onChange: (options: WriteOptions) => void
  onlyDue: boolean
  onOnlyDueChange: (onlyDue: boolean) => void
  online: boolean
  loadingDue: boolean
  dueError: string | null
  /** Cartes retenues pour la session. */
  count: number
  onStart: () => void
}) {
  const status = dueStatus({ onlyDue, errorText: dueError, loading: loadingDue, count })
  useAnnounce(status)

  return (
    <Screen scroll padded>
      <Card>
        <View style={styles.page}>
          <View style={styles.intro}>
            <Text variant="heading" weight="semibold" accessibilityRole="header">
              Mode écrit
            </Text>
            <Text variant="label" tone="muted">
              Tapez la réponse. La casse, les accents et la ponctuation sont ignorés, et quelques
              fautes de frappe sont tolérées. Ce mode ne modifie pas votre planification de
              révision.
            </Text>
          </View>

          <RadioGroup
            label="Je vois…"
            value={options.direction}
            options={WRITE_DIRECTIONS}
            onValueChange={(direction) => onChange({ ...options, direction })}
          />
          <Checkbox
            label="Mélanger les cartes"
            checked={options.shuffle}
            onCheckedChange={(shuffle) => onChange({ ...options, shuffle })}
          />
          <Checkbox
            label={DUE_OPTION_LABEL}
            description={online ? undefined : DUE_OFFLINE_HINT}
            checked={onlyDue}
            disabled={!online}
            onCheckedChange={onOnlyDueChange}
          />
          {status !== null && (
            <Text variant="label" tone="muted">
              {status}
            </Text>
          )}

          <Button
            label={startLabel(count)}
            icon="edit-3"
            fullWidth
            disabled={loadingDue || count === 0}
            onPress={onStart}
          />
        </View>
      </Card>
    </Screen>
  )
}

function WriteSession({
  setId,
  questions,
  onRestart,
  onChangeOptions,
}: {
  setId: string
  questions: WriteQuestion[]
  onRestart: () => void
  onChangeOptions: () => void
}) {
  const [state, dispatch] = useReducer(writeReducer, questions, initWrite)
  const [given, setGiven] = useState('')
  const input = useRef<TextInput>(null)
  const question = state.questions[state.index]
  const current = state.current
  const answered = current !== null
  const feedback = current ? writeFeedback(current) : null

  // Saisie prête à chaque question (le clavier s'ouvre) ; fin de séance : clavier refermé.
  useEffect(() => {
    if (state.finished) Keyboard.dismiss()
    else if (!answered) focusInput(input.current)
  }, [answered, state.finished])

  useAnnounce(
    question && !state.finished
      ? questionAnnouncement(state.index, state.questions.length, writeStatement(question))
      : null,
  )
  useAnnounce(feedback ? writeFeedbackAnnouncement(feedback) : null)

  function next() {
    dispatch({ type: 'next' })
    setGiven('')
  }

  // Clavier : « valider » avant la correction, « continuer » ensuite (le champ garde le focus).
  function submit() {
    if (answered) next()
    else dispatch({ type: 'submit', given })
  }

  return (
    <Screen scroll padded keyboardAvoiding>
      <View style={styles.page}>
        <SessionProgress
          left={questionPosition(
            state.index,
            state.questions.length,
            state.finished,
            'Session terminée',
          )}
          right={correctCountLabel(
            state.answers.filter(isWriteCorrect).length,
            state.answers.length,
          )}
          percent={percentOf(state.answers.length, state.questions.length)}
          label="Progression de la session"
        />

        {state.finished || !question ? (
          <WriteResult
            state={state}
            setId={setId}
            onRestart={onRestart}
            onChangeOptions={onChangeOptions}
          />
        ) : (
          <View style={styles.page}>
            <View>
              <Text variant="label" tone="muted">
                {promptLabel(question.shown)}
              </Text>
              <Text variant="title" weight="semibold">
                {question.prompt}
              </Text>
            </View>

            <TextField
              label={answerFieldLabel(question.shown)}
              value={given}
              onChangeText={(text) => {
                if (!answered) setGiven(text)
              }}
              inputRef={input}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={submit}
            />

            {feedback && (
              <View style={styles.feedback}>
                <Text
                  variant="label"
                  weight="medium"
                  tone={feedback.correct ? 'success' : 'destructive'}
                >
                  {feedback.title}
                </Text>
                {feedback.detail !== null && (
                  <Text variant="label" tone={feedback.correct ? 'success' : 'destructive'}>
                    {feedback.detail}
                  </Text>
                )}
              </View>
            )}

            {current ? (
              <View style={styles.actions}>
                <Button
                  label={continueLabel(state.index, state.questions.length)}
                  fullWidth
                  onPress={next}
                />
                {canOverride(current) && (
                  <Button
                    label="J'avais raison"
                    variant="outline"
                    fullWidth
                    onPress={() => dispatch({ type: 'override' })}
                  />
                )}
              </View>
            ) : (
              <View style={styles.actions}>
                <Button label="Valider" fullWidth onPress={submit} />
                <Button
                  label="Je ne sais pas"
                  variant="ghost"
                  fullWidth
                  onPress={() => dispatch({ type: 'submit', given: '' })}
                />
              </View>
            )}
          </View>
        )}
      </View>
    </Screen>
  )
}

function WriteResult({
  state,
  setId,
  onRestart,
  onChangeOptions,
}: {
  state: WriteState
  setId: string
  onRestart: () => void
  onChangeOptions: () => void
}) {
  const { correct, total, mistakes } = writeScoreOf(state)
  return (
    <ScoreResult
      correct={correct}
      total={total}
      mistakesTitle="Erreurs"
      mistakes={writeMistakeRows(mistakes)}
    >
      <Button label="Recommencer" icon="rotate-ccw" fullWidth onPress={onRestart} />
      <Button
        label="Changer les options"
        variant="outline"
        icon="sliders"
        fullWidth
        onPress={onChangeOptions}
      />
      <BackToSetButton setId={setId} />
    </ScoreResult>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  intro: { gap: spacing.xs },
  feedback: { gap: spacing.xs },
  actions: { gap: spacing.sm },
})
