import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, LogOut, Play, RotateCcw, Volume2 } from 'lucide-react'
import './App.css'
import { loadDecks } from './decks/registry'
import { getDeckStats } from './srs/queue'
import { getNextIntervalLabel } from './srs/scheduler'
import { useStudyStore } from './store/useStudyStore'
import type { CardRating, Deck } from './types'

const ratingLabels: Record<CardRating, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
}

function App() {
  const decks = useMemo(() => loadDecks(), [])
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [dailyNewLimitDraft, setDailyNewLimitDraft] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const dailyNewLimit = useStudyStore((state) => state.dailyNewLimit)
  const shuffleSessions = useStudyStore((state) => state.shuffleSessions)
  const progressByDeck = useStudyStore((state) => state.progressByDeck)
  const session = useStudyStore((state) => state.session)
  const setDailyNewLimit = useStudyStore((state) => state.setDailyNewLimit)
  const setShuffleSessions = useStudyStore((state) => state.setShuffleSessions)
  const startSession = useStudyStore((state) => state.startSession)
  const rateCard = useStudyStore((state) => state.rateCard)
  const endSession = useStudyStore((state) => state.endSession)
  const resetDeckProgress = useStudyStore((state) => state.resetDeckProgress)

  const selectedDeck =
    decks.find((deck) => deck.id === (session?.deckId ?? selectedDeckId)) ?? null
  const currentCardId = session?.queue[0]
  const currentCard = selectedDeck?.cards.find((card) => card.id === currentCardId)
  const currentProgress =
    selectedDeck && currentCard ? progressByDeck[selectedDeck.id]?.[currentCard.id] : undefined

  const handleStart = (deck: Deck) => {
    setSelectedDeckId(deck.id)
    setShowAnswer(false)
    startSession(deck)
  }

  const handleRate = (rating: CardRating) => {
    if (!selectedDeck || !currentCard) {
      return
    }
    rateCard(selectedDeck, currentCard.id, rating)
    setShowAnswer(false)
  }

  const playCurrentAudio = () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    audio.currentTime = 0
    void audio.play().catch(() => {
      // Some mobile browsers may require an extra tap for playback.
    })
  }

  useEffect(() => {
    if (!currentCard?.audioFile) {
      return
    }
    playCurrentAudio()
  }, [currentCardId, currentCard?.audioFile])

  useEffect(() => {
    setDailyNewLimitDraft(String(dailyNewLimit))
  }, [dailyNewLimit])

  const commitDailyNewLimit = () => {
    const parsed = Number(dailyNewLimitDraft)
    if (!Number.isFinite(parsed)) {
      setDailyNewLimitDraft(String(dailyNewLimit))
      return
    }
    const clamped = Math.max(1, Math.min(50, Math.round(parsed)))
    setDailyNewLimit(clamped)
    setDailyNewLimitDraft(String(clamped))
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <span className="topbar-kicker">Thai Study Companion</span>
        <h1>Thai Flashcards</h1>
        <p className="topbar-subtitle">Anki-style spaced repetition with quick audio-first review.</p>
      </header>

      {!session && (
        <section className="panel">
          <div className="setting-row">
            <label htmlFor="new-limit">Daily new card limit</label>
            <input
              id="new-limit"
              type="number"
              min={1}
              max={50}
              value={dailyNewLimitDraft}
              onChange={(event) => setDailyNewLimitDraft(event.target.value)}
              onBlur={commitDailyNewLimit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitDailyNewLimit()
                }
              }}
            />
          </div>
          <div className="setting-row setting-checkbox">
            <label htmlFor="shuffle-sessions">Shuffle cards in session</label>
            <input
              id="shuffle-sessions"
              type="checkbox"
              checked={shuffleSessions}
              onChange={(event) => setShuffleSessions(event.target.checked)}
            />
          </div>
        </section>
      )}

      {!session && (
        <section className="deck-grid">
          {decks.map((deck) => {
            const stats = getDeckStats(deck, progressByDeck[deck.id])
            return (
              <article key={deck.id} className="panel deck-card">
                <h2>{deck.title}</h2>
                <p>{deck.description}</p>
                <div className="stats-row">
                  <span>{stats.due} due</span>
                  <span>{Math.min(stats.newCards, dailyNewLimit)} new today</span>
                  <span>{stats.newCards} new remaining</span>
                  <span>{stats.total} total</span>
                </div>
                <button className="primary" onClick={() => handleStart(deck)}>
                  <Play size={16} aria-hidden="true" />
                  Start Session
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Reset all progress for "${deck.title}"? This cannot be undone.`,
                    )
                    if (!confirmed) {
                      return
                    }
                    resetDeckProgress(deck.id)
                  }}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Reset Deck Progress
                </button>
              </article>
            )
          })}
        </section>
      )}

      {session && selectedDeck && currentCard && (
        <section className="study-layout">
          <article className="panel flashcard">
            {currentCard.audioFile && (
              <audio ref={audioRef} preload="auto" src={currentCard.audioFile} />
            )}
            <p className="card-label">Prompt</p>
            <h2 className="thai-word">
              {currentCard.thai ? <span className="thai-script">{currentCard.thai}</span> : null}
              <span className="romanized-script">{currentCard.romanized}</span>
            </h2>
            <button
              className="secondary replay"
              onClick={playCurrentAudio}
              disabled={!currentCard.audioFile}
            >
              <Volume2 size={16} aria-hidden="true" />
              Replay Audio
            </button>
            {!showAnswer ? (
              <button className="primary reveal" onClick={() => setShowAnswer(true)}>
                <Eye size={16} aria-hidden="true" />
                Reveal Answer
              </button>
            ) : (
              <>
                <div className="answer-block">
                  <p>
                    <strong>English:</strong> {currentCard.english}
                  </p>
                  {currentCard.literal ? (
                    <p>
                      <strong>Literal:</strong> {currentCard.literal}
                    </p>
                  ) : null}
                  {currentCard.note ? (
                    <p>
                      <strong>Note:</strong> {currentCard.note}
                    </p>
                  ) : null}
                  {!currentCard.audioFile ? (
                    <p className="muted">No audio available.</p>
                  ) : null}
                </div>

                <div className="rating-grid">
                  {(Object.keys(ratingLabels) as CardRating[]).map((rating) => (
                    <button
                      key={rating}
                      className={`rating ${rating}`}
                      onClick={() => handleRate(rating)}
                    >
                      <span className="rating-label">{ratingLabels[rating]}</span>
                      <span className="rating-interval">
                        {getNextIntervalLabel(currentProgress, rating)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </article>

          <article className="panel session-info">
            <h3>Session Snapshot</h3>
            <p>
              <strong>Deck:</strong> {selectedDeck.title}
            </p>
            <p>
              <strong>Remaining:</strong> {session.queue.length}
            </p>
            <p>
              <strong>Order:</strong> {session.shuffle ? 'Shuffled' : 'Due then New'}
            </p>
            <p>
              <strong>Reviewed:</strong> {session.stats.reviewed}
            </p>
            <button className="secondary" onClick={endSession}>
              <LogOut size={16} aria-hidden="true" />
              End Session
            </button>
          </article>
        </section>
      )}

      {session && selectedDeck && !currentCard && (
        <section className="panel summary">
          <h2 className="summary-title">Session Complete</h2>
          <p>You reviewed {session.stats.reviewed} cards.</p>
          <div className="stats-row">
            <span>Again: {session.stats.again}</span>
            <span>Hard: {session.stats.hard}</span>
            <span>Good: {session.stats.good}</span>
            <span>Easy: {session.stats.easy}</span>
          </div>
          <button
            className="primary"
            onClick={() => {
              setShowAnswer(false)
              startSession(selectedDeck)
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Study Again
          </button>
          <button className="secondary" onClick={endSession}>
            <LogOut size={16} aria-hidden="true" />
            Back to Decks
          </button>
        </section>
      )}
    </main>
  )
}

export default App
