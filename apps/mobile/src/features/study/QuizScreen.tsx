import {
  currentQuestion,
  initQuiz,
  mistakesOf,
  type QuizQuestion,
  type QuizState,
  quizReducer,
  quizScoreOf,
} from '@quizlet/shared'
import { Stack, useRouter } from 'expo-router'
import { useReducer, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { SetGate } from '@/features/common'
import { type SetDetail, useQuiz } from '@/lib/queries'
import { queryView } from '@/lib/query-state'
import { routes } from '@/lib/routes'
import { useIdParam } from '@/lib/use-id-param'
import { useIsOnline } from '@/offline'
import { Button, EmptyState, ErrorState, LoadingState, Screen, spacing, Text } from '@/ui'
import { BackToSetButton } from './BackToSetButton'
import { ChoiceButton } from './ChoiceButton'
import { choiceStatus } from './choice-status'
import {
  isNotEnoughCards,
  nextQuestionLabel,
  QUIZ_OFFLINE_MESSAGE,
  QUIZ_OFFLINE_TITLE,
  QUIZ_PROMPT,
  quizFeedback,
  quizMistakeRows,
  quizStatement,
} from './quiz-text'
import { correctCountLabel, percentOf, questionAnnouncement, questionPosition } from './result-text'
import { ScoreResult } from './ScoreResult'
import { SessionProgress } from './SessionProgress'
import { useAnnounce } from './use-announce'

/** Quiz d'un set (4 choix par question) : le tirage vient de l'API, donc une connexion. */
export function QuizScreen() {
  const id = useIdParam()
  // « Nouveau quiz » = nouvelle tentative, donc nouveau tirage (clé de requête `attempt`).
  const [attempt, setAttempt] = useState(0)
  const quiz = useQuiz(id, attempt)

  return (
    <SetGate id={id}>
      {(set) => (
        <>
          <Stack.Screen options={{ title: `Quiz · ${set.title}` }} />
          {quiz.data !== undefined ? (
            <QuizSession
              key={attempt}
              set={set}
              questions={quiz.data}
              onRestart={() => setAttempt((value) => value + 1)}
            />
          ) : (
            <Screen padded>
              <QuizPending set={set} quiz={quiz} />
            </Screen>
          )}
        </>
      )}
    </SetGate>
  )
}

/** Quiz pas (encore) prêt : hors ligne, chargement, set trop petit ou erreur. */
function QuizPending({ set, quiz }: { set: SetDetail; quiz: ReturnType<typeof useQuiz> }) {
  const view = queryView(quiz)
  if (view === 'offline') {
    return (
      <EmptyState
        icon="wifi-off"
        title={QUIZ_OFFLINE_TITLE}
        description={QUIZ_OFFLINE_MESSAGE}
        action={<BackToSetButton setId={set.id} variant="primary" />}
      />
    )
  }
  if (view === 'loading') return <LoadingState label="Préparation du quiz…" rows={4} />
  if (isNotEnoughCards(quiz.error)) {
    return (
      <EmptyState
        icon="list"
        title="Pas assez de cartes pour un quiz"
        description={quiz.error.message}
        action={<BackToSetButton setId={set.id} variant="primary" />}
      />
    )
  }
  return <ErrorState error={quiz.error} onRetry={() => void quiz.refetch()} />
}

function QuizSession({
  set,
  questions,
  onRestart,
}: {
  set: SetDetail
  questions: QuizQuestion[]
  onRestart: () => void
}) {
  const [state, dispatch] = useReducer(quizReducer, questions, initQuiz)
  const question = currentQuestion(state)
  const answer = state.answers[state.index]
  const score = quizScoreOf(state)
  const feedback = question ? quizFeedback(question, answer) : null

  // Nouvelle question : énoncé annoncé (le web y déplace le focus) ; puis le retour de la réponse.
  useAnnounce(
    question
      ? questionAnnouncement(state.index, state.questions.length, quizStatement(question.term))
      : null,
  )
  useAnnounce(feedback?.text ?? null)

  return (
    <Screen scroll padded>
      <View style={styles.page}>
        <SessionProgress
          left={questionPosition(
            state.index,
            state.questions.length,
            state.finished,
            'Quiz terminé',
          )}
          right={correctCountLabel(score.correct, score.answered)}
          percent={percentOf(score.answered, score.total)}
          label="Progression du quiz"
        />

        {state.finished || !question ? (
          <QuizResult state={state} setId={set.id} onRestart={onRestart} />
        ) : (
          <View style={styles.page}>
            <View>
              <Text variant="label" tone="muted">
                {QUIZ_PROMPT}
              </Text>
              <Text variant="title" weight="semibold" accessibilityRole="header">
                {question.term}
              </Text>
            </View>

            <View
              accessibilityRole="list"
              accessibilityLabel="Réponses proposées"
              style={styles.choices}
            >
              {question.choices.map((choice, index) => (
                // Les choix d'une question sont distincts : le texte sert de clé.
                <ChoiceButton
                  key={choice}
                  index={index}
                  label={choice}
                  status={choiceStatus(question, answer, index)}
                  onSelect={() => dispatch({ type: 'answer', choice: index })}
                />
              ))}
            </View>

            <View style={styles.feedback}>
              {feedback && (
                <Text
                  variant="label"
                  weight="medium"
                  tone={feedback.correct ? 'success' : 'destructive'}
                >
                  {feedback.text}
                </Text>
              )}
            </View>

            {answer !== undefined && (
              <Button
                label={nextQuestionLabel(state.index, state.questions.length)}
                fullWidth
                onPress={() => dispatch({ type: 'next' })}
              />
            )}
          </View>
        )}
      </View>
    </Screen>
  )
}

function QuizResult({
  state,
  setId,
  onRestart,
}: {
  state: QuizState
  setId: string
  onRestart: () => void
}) {
  const router = useRouter()
  const online = useIsOnline()
  const { correct, total } = quizScoreOf(state)

  return (
    <ScoreResult
      correct={correct}
      total={total}
      mistakesTitle="Erreurs à revoir"
      mistakes={quizMistakeRows(mistakesOf(state))}
    >
      {/* Un nouveau tirage demande l'API : hors ligne, on garde le résultat plutôt qu'une impasse. */}
      <Button
        label="Nouveau quiz"
        icon="rotate-ccw"
        fullWidth
        disabled={!online}
        onPress={onRestart}
      />
      {!online && (
        <Text variant="caption" tone="muted">
          {QUIZ_OFFLINE_MESSAGE}
        </Text>
      )}
      <Button
        label="Réviser en flashcards"
        variant="outline"
        icon="layers"
        fullWidth
        onPress={() => router.push(routes.flashcards(setId))}
      />
      <BackToSetButton setId={setId} />
    </ScoreResult>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  choices: { gap: spacing.md },
  feedback: { minHeight: 24 },
})
