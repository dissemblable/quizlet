export interface QuizQuestion {
  cardId: string
  term: string
  choices: string[]
  answerIndex: number
}

export interface QuizState {
  questions: QuizQuestion[]
  index: number
  /** Choix de l'utilisateur pour chaque question (undefined tant qu'il n'a pas répondu). */
  answers: Array<number | undefined>
  finished: boolean
}

export type QuizAction = { type: 'answer'; choice: number } | { type: 'next' }

export function initQuiz(questions: QuizQuestion[]): QuizState {
  return { questions, index: 0, answers: questions.map(() => undefined), finished: false }
}

export function currentQuestion(state: QuizState): QuizQuestion | undefined {
  return state.finished ? undefined : state.questions[state.index]
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  const question = currentQuestion(state)
  if (!question) return state

  switch (action.type) {
    case 'answer': {
      // Une seule réponse par question, parmi les choix proposés.
      const valid = Number.isInteger(action.choice) && action.choice >= 0
      if (state.answers[state.index] !== undefined || !valid) return state
      if (action.choice >= question.choices.length) return state
      const answers = [...state.answers]
      answers[state.index] = action.choice
      return { ...state, answers }
    }
    case 'next':
      if (state.answers[state.index] === undefined) return state
      if (state.index >= state.questions.length - 1) return { ...state, finished: true }
      return { ...state, index: state.index + 1 }
  }
}

export interface QuizScore {
  correct: number
  answered: number
  total: number
  /** Pourcentage de bonnes réponses sur l'ensemble du quiz, arrondi. */
  percent: number
}

export function scoreOf(state: QuizState): QuizScore {
  const total = state.questions.length
  let correct = 0
  let answered = 0
  state.questions.forEach((question, i) => {
    const answer = state.answers[i]
    if (answer === undefined) return
    answered++
    if (answer === question.answerIndex) correct++
  })
  return {
    correct,
    answered,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
  }
}

export interface QuizMistake {
  question: QuizQuestion
  chosen: string
  expected: string
}

export function mistakesOf(state: QuizState): QuizMistake[] {
  return state.questions.flatMap((question, i) => {
    const answer = state.answers[i]
    if (answer === undefined || answer === question.answerIndex) return []
    return [
      {
        question,
        chosen: question.choices[answer] ?? '',
        expected: question.choices[question.answerIndex] ?? '',
      },
    ]
  })
}

export function verdict(percent: number): string {
  if (percent === 100) return 'Sans faute, bravo !'
  if (percent >= 80) return 'Excellent travail !'
  if (percent >= 50) return 'Bien joué, encore un effort.'
  return 'Continuez à réviser, ça viendra.'
}
