export type CardRating = 'again' | 'hard' | 'good' | 'easy'
export type CardState = 'new' | 'learning' | 'review' | 'relearning'

export type Flashcard = {
  id: string
  english: string
  romanized: string
  thai: string
  literal?: string
  note?: string
  audioFile?: string
}

export type Deck = {
  id: string
  title: string
  description?: string
  cards: Flashcard[]
}

export type CardProgress = {
  repetitions: number
  intervalDays: number
  easeFactor: number
  lapses: number
  state: CardState
  learningStep: number | null
  dueAt: string
  lastReviewedAt: string | null
}

export type DeckProgress = Record<string, CardProgress>

export type StudyStats = {
  again: number
  hard: number
  good: number
  easy: number
  reviewed: number
}

export type StudySession = {
  deckId: string
  queue: string[]
  shuffle: boolean
  reviewedCardIds: string[]
  stats: StudyStats
}
