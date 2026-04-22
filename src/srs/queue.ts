import type { CardProgress, Deck, DeckProgress } from '../types'

export type DeckStats = {
  due: number
  newCards: number
  total: number
}

type CardState = {
  cardId: string
  dueAt: string
}

export const isDue = (progress: CardProgress, now = new Date()): boolean =>
  new Date(progress.dueAt).getTime() <= now.getTime()

export const buildDeckQueue = (
  deck: Deck,
  deckProgress: DeckProgress | undefined,
  dailyNewLimit: number,
): string[] => {
  const now = new Date()
  const due: CardState[] = []
  const brandNew: string[] = []

  deck.cards.forEach((card) => {
    const progress = deckProgress?.[card.id]
    if (!progress) {
      brandNew.push(card.id)
      return
    }
    if (isDue(progress, now)) {
      due.push({ cardId: card.id, dueAt: progress.dueAt })
    }
  })

  due.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
  const newSlice = brandNew.slice(0, dailyNewLimit)
  return [...due.map((item) => item.cardId), ...newSlice]
}

export const getDeckStats = (
  deck: Deck,
  deckProgress: DeckProgress | undefined,
): DeckStats => {
  const now = new Date()
  let due = 0
  let newCards = 0

  deck.cards.forEach((card) => {
    const progress = deckProgress?.[card.id]
    if (!progress) {
      newCards += 1
      return
    }
    if (isDue(progress, now)) {
      due += 1
    }
  })

  return {
    due,
    newCards,
    total: deck.cards.length,
  }
}
