import type { Deck } from '../types'
import { loadAutoDecks } from './autoDecks'

export const loadDecks = (): Deck[] => loadAutoDecks()
