import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildDeckQueue } from '../srs/queue'
import { applySm2Rating } from '../srs/scheduler'
import type { CardRating, Deck, DeckProgress, StudyDirection, StudySession } from '../types'

type PersistedState = {
  version: number
  dailyNewLimit: number
  shuffleSessions: boolean
  studyDirection: StudyDirection
  progressByDeck: Record<string, DeckProgress>
}

type StudyStore = PersistedState & {
  session: StudySession | null
  setDailyNewLimit: (value: number) => void
  setShuffleSessions: (value: boolean) => void
  setStudyDirection: (value: StudyDirection) => void
  startSession: (deck: Deck) => void
  rateCard: (deck: Deck, cardId: string, rating: CardRating) => void
  endSession: () => void
  resetDeckProgress: (deckId: string) => void
}

const STORAGE_KEY = 'thai-srs-v1'

const defaultStats = () => ({
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
  reviewed: 0,
})

export const useStudyStore = create<StudyStore>()(
  persist(
    (set, get) => ({
      version: 2,
      dailyNewLimit: 12,
      shuffleSessions: true,
      studyDirection: 'thaiToEnglish',
      progressByDeck: {},
      session: null,
      setDailyNewLimit: (value) => {
        const safe = Number.isNaN(value) ? 12 : Math.min(50, Math.max(1, value))
        set({ dailyNewLimit: safe })
      },
      setShuffleSessions: (value) => {
        set({ shuffleSessions: value })
      },
      setStudyDirection: (value) => {
        set({ studyDirection: value })
      },
      startSession: (deck) => {
        const shuffle = get().shuffleSessions
        const studyDirection = get().studyDirection
        const queue = buildDeckQueue(
          deck,
          get().progressByDeck[deck.id],
          get().dailyNewLimit,
          shuffle,
        )
        set({
          session: {
            deckId: deck.id,
            queue,
            shuffle,
            studyDirection,
            reviewedCardIds: [],
            stats: defaultStats(),
          },
        })
      },
      rateCard: (deck, cardId, rating) => {
        const state = get()
        const deckProgress = state.progressByDeck[deck.id] ?? {}
        const nextProgress = applySm2Rating(deckProgress[cardId], rating)
        const nextDeckProgress: DeckProgress = {
          ...deckProgress,
          [cardId]: nextProgress,
        }
        const session = state.session
        if (!session) {
          set({
            progressByDeck: {
              ...state.progressByDeck,
              [deck.id]: nextDeckProgress,
            },
          })
          return
        }

        const currentIndex = session.queue.indexOf(cardId)
        const remaining =
          currentIndex === -1
            ? session.queue
            : [
                ...session.queue.slice(0, currentIndex),
                ...session.queue.slice(currentIndex + 1),
              ]
        const shouldRequeue =
          nextProgress.state === 'learning' || nextProgress.state === 'relearning'
        const nextQueue = shouldRequeue ? [...remaining, cardId] : remaining
        set({
          progressByDeck: {
            ...state.progressByDeck,
            [deck.id]: nextDeckProgress,
          },
          session: {
            ...session,
            queue: nextQueue,
            reviewedCardIds: [...session.reviewedCardIds, cardId],
            stats: {
              ...session.stats,
              reviewed: session.stats.reviewed + 1,
              [rating]: session.stats[rating] + 1,
            },
          },
        })
      },
      endSession: () => set({ session: null }),
      resetDeckProgress: (deckId) => {
        const progressByDeck = { ...get().progressByDeck }
        delete progressByDeck[deckId]
        const session = get().session
        set({
          progressByDeck,
          session: session?.deckId === deckId ? null : session,
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        version: state.version,
        dailyNewLimit: state.dailyNewLimit,
        shuffleSessions: state.shuffleSessions,
        studyDirection: state.studyDirection,
        progressByDeck: state.progressByDeck,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as PersistedState),
      }),
    },
  ),
)
