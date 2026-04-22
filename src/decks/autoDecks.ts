import Papa from 'papaparse'
import type { Deck, Flashcard } from '../types'

type RawCard = {
  id: string
  english: string
  romanized: string
  thai: string
  literal?: string
  note?: string
}

type RawAudioCard = RawCard & {
  audio: string
}

type DeckMeta = {
  id?: string
  title?: string
  description?: string
}

const cardsByPath = import.meta.glob('../../decks/*/thai_words.csv', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const manifestsByPath = import.meta.glob('../../decks/*/audio/audio_manifest.csv', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const audioByPath = import.meta.glob('../../decks/*/audio/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const metaByPath = import.meta.glob('../../decks/*/deck.json', {
  eager: true,
  import: 'default',
}) as Record<string, DeckMeta>

const parseCsv = <T,>(source: string): T[] => {
  const result = Papa.parse<T>(source, {
    header: true,
    skipEmptyLines: true,
  })

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message)
  }

  return result.data
}

const normalizeAudioToken = (token: string): string =>
  token.replace('[sound:', '').replace(']', '').trim()

const toTitle = (value: string): string =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')

const getDeckFolderFromPath = (path: string): string => {
  const match = path.match(/^\.\.\/\.\.\/decks\/([^/]+)\//)
  if (!match) {
    throw new Error(`Could not resolve deck folder from path "${path}"`)
  }
  return match[1]
}

const getDeckMeta = (folder: string): DeckMeta =>
  metaByPath[`../../decks/${folder}/deck.json`] ?? {}

const getAudioLookupForFolder = (folder: string): Record<string, string> => {
  const lookup: Record<string, string> = {}
  Object.entries(audioByPath).forEach(([path, url]) => {
    if (!path.startsWith(`../../decks/${folder}/audio/`)) {
      return
    }
    const filename = path.split('/').pop()
    if (filename) {
      lookup[filename] = url
    }
  })
  return lookup
}

const normalizeCard = (row: RawCard, audioUrl?: string): Flashcard => ({
  id: row.id.trim(),
  english: row.english.trim(),
  romanized: row.romanized.trim(),
  thai: row.thai?.trim() ?? '',
  literal: row.literal?.trim() || undefined,
  note: row.note?.trim() || undefined,
  audioFile: audioUrl,
})

const loadDeckFromFolder = (folder: string): Deck => {
  const cardsPath = `../../decks/${folder}/thai_words.csv`
  const manifestPath = `../../decks/${folder}/audio/audio_manifest.csv`
  const cardsCsv = cardsByPath[cardsPath]
  const manifestCsv = manifestsByPath[manifestPath]
  if (!cardsCsv) {
    throw new Error(`Missing thai_words.csv for deck folder "${folder}"`)
  }
  if (!manifestCsv) {
    throw new Error(`Missing audio/audio_manifest.csv for deck folder "${folder}"`)
  }

  const cardRows = parseCsv<RawCard>(cardsCsv)
  const audioRows = parseCsv<RawAudioCard>(manifestCsv)
  const audioRowById = new Map(audioRows.map((row) => [row.id.trim(), row]))
  const audioLookup = getAudioLookupForFolder(folder)
  const deckMeta = getDeckMeta(folder)

  const seenIds = new Set<string>()
  const cards = cardRows.map((row) => {
    const id = row.id?.trim()
    if (!id || !row.english || !row.romanized) {
      throw new Error(`Malformed row in deck "${folder}" for id "${row.id ?? 'unknown'}"`)
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate card id "${id}" found in deck "${folder}"`)
    }
    seenIds.add(id)

    const audioToken = audioRowById.get(id)?.audio
      ? normalizeAudioToken(audioRowById.get(id)!.audio)
      : undefined
    const audioUrl = audioToken ? audioLookup[audioToken] : undefined

    return normalizeCard(row, audioUrl)
  })

  return {
    id: deckMeta.id?.trim() || folder,
    title: deckMeta.title?.trim() || toTitle(folder),
    description: deckMeta.description?.trim() || `${toTitle(folder)} deck`,
    cards,
  }
}

export const loadAutoDecks = (): Deck[] => {
  const folders = Object.keys(cardsByPath).map(getDeckFolderFromPath)
  const uniqueFolders = Array.from(new Set(folders)).sort()
  return uniqueFolders.map(loadDeckFromFolder)
}
