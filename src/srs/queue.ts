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
  shuffle: boolean,
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
  const queue = [...due.map((item) => item.cardId), ...newSlice]
  if (!shuffle) {
    return queue
  }
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = queue[i]
    queue[i] = queue[j]
    queue[j] = temp
  }
  return queue
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
