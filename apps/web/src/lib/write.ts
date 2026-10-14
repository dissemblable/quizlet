import { type RandomFn, shuffle } from '@quizlet/shared'

/** Forme comparable d'une réponse : sans casse, accents, ponctuation ni espaces superflus. */
export function normalizeForComparison(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/\p{P}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Distance de Levenshtein (insertions, suppressions, substitutions), par caractère Unicode. */
export function levenshtein(a: string, b: string): number {
  const source = Array.from(a)
  const target = Array.from(b)
  let previous = Array.from({ length: target.length + 1 }, (_, index) => index)
  for (let i = 1; i <= source.length; i++) {
    const current = [i]
    for (let j = 1; j <= target.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (source[i - 1] === target[j - 1] ? 0 : 1)
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution)
    }
    previous = current
  }
  return previous[target.length] ?? 0
}

/** Fautes de frappe tolérées : une par tranche de 5 caractères (aucune sous 5 caractères). */
export function allowedTypos(expected: string): number {
  return Math.floor(Array.from(expected).length / 5)
}

/** `typo` : réponse acceptée malgré quelques fautes de frappe. */
export type AnswerResult = 'exact' | 'typo' | 'wrong'

export function checkAnswer(answer: string, expected: string): AnswerResult {
  const given = normalizeForComparison(answer)
  const target = normalizeForComparison(expected)
  if (given === target) return 'exact'
  if (given === '') return 'wrong'
  return levenshtein(given, target) <= allowedTypos(target) ? 'typo' : 'wrong'
}

/** Ce qui est affiché : le terme (on écrit la définition), la définition, ou l'un ou l'autre. */
export type WriteDirection = 'term' | 'definition' | 'mixed'

export interface WriteOptions {
  direction: WriteDirection
  shuffle: boolean
}

export interface WriteQuestion {
  cardId: string
  /** Côté affiché de la carte. */
  shown: 'term' | 'definition'
  prompt: string
  answer: string
}

export interface WriteAnswer {
  question: WriteQuestion
  given: string
  result: AnswerResult
  /** « J'avais raison » : réponse comptée juste malgré la correction. */
  overridden: boolean
}

export interface WriteState {
  questions: WriteQuestion[]
  index: number
  /** Réponse à la question courante, une fois validée (affichage de la correction). */
  current: WriteAnswer | null
  answers: WriteAnswer[]
  finished: boolean
}

export type WriteAction =
  | { type: 'submit'; given: string }
  | { type: 'override' }
  | { type: 'next' }

interface CardLike {
  id: string
  term: string
  definition: string
}

export function buildQuestions(
  cards: readonly CardLike[],
  { direction, shuffle: shuffled }: WriteOptions,
  random: RandomFn = Math.random,
): WriteQuestion[] {
  const ordered = shuffled ? shuffle(cards, random) : [...cards]
  return ordered.map((card) => {
    const shown = direction === 'mixed' ? (random() < 0.5 ? 'term' : 'definition') : direction
    return shown === 'term'
      ? { cardId: card.id, shown, prompt: card.term, answer: card.definition }
      : { cardId: card.id, shown, prompt: card.definition, answer: card.term }
  })
}

export function initWrite(questions: WriteQuestion[]): WriteState {
  return { questions, index: 0, current: null, answers: [], finished: questions.length === 0 }
}

export function writeReducer(state: WriteState, action: WriteAction): WriteState {
  const question = state.questions[state.index]
  if (state.finished || !question) return state
  switch (action.type) {
    case 'submit':
      if (state.current) return state
      return {
        ...state,
        current: {
          question,
          given: action.given,
          result: checkAnswer(action.given, question.answer),
          overridden: false,
        },
      }
    case 'override':
      if (state.current?.result !== 'wrong') return state
      return { ...state, current: { ...state.current, overridden: true } }
    case 'next': {
      if (!state.current) return state
      const answers = [...state.answers, state.current]
      const index = state.index + 1
      return { ...state, answers, index, current: null, finished: index >= state.questions.length }
    }
  }
}

export function isCorrect(answer: WriteAnswer): boolean {
  return answer.result !== 'wrong' || answer.overridden
}

export function scoreOf(state: WriteState) {
  const correct = state.answers.filter(isCorrect).length
  return {
    correct,
    total: state.questions.length,
    mistakes: state.answers.filter((a) => !isCorrect(a)),
  }
}
