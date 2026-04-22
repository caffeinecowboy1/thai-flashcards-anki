import type { CardProgress, CardRating, CardState } from '../types'

const MIN_EASE = 1.3
const STARTING_EASE = 2.5
const LEARNING_STEPS_MINUTES = [1, 10]
const RELEARNING_STEPS_MINUTES = [10]

const toIsoAfterMinutes = (minutes: number): string =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString()

const toIsoAfterDays = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

const getStepMinutes = (state: CardState, stepIndex: number): number => {
  const steps = state === 'relearning' ? RELEARNING_STEPS_MINUTES : LEARNING_STEPS_MINUTES
  return steps[Math.min(stepIndex, steps.length - 1)] ?? steps[0]
}

const toIntervalLabel = (dueAt: string): string => {
  const diffMs = new Date(dueAt).getTime() - Date.now()
  if (diffMs <= 0) {
    return 'now'
  }
  const minutes = Math.round(diffMs / (60 * 1000))
  if (minutes < 60) {
    return `${minutes}m`
  }
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000))
  return `${days}d`
}

const toReviewState = (
  base: CardProgress,
  nowIso: string,
  nextInterval: number,
  nextEase: number,
): CardProgress => ({
  ...base,
  state: 'review',
  learningStep: null,
  repetitions: base.repetitions + 1,
  intervalDays: nextInterval,
  easeFactor: nextEase,
  dueAt: toIsoAfterDays(nextInterval),
  lastReviewedAt: nowIso,
})

export const createNewProgress = (): CardProgress => ({
  repetitions: 0,
  intervalDays: 0,
  easeFactor: STARTING_EASE,
  lapses: 0,
  state: 'new',
  learningStep: 0,
  dueAt: new Date().toISOString(),
  lastReviewedAt: null,
})

export const applySm2Rating = (
  current: CardProgress | undefined,
  rating: CardRating,
): CardProgress => {
  const base: CardProgress = current
    ? {
        ...current,
        state: current.state ?? (current.repetitions > 0 ? 'review' : 'new'),
        learningStep: current.learningStep ?? 0,
      }
    : createNewProgress()
  const nowIso = new Date().toISOString()
  const isLearningState = base.state === 'new' || base.state === 'learning'
  const isRelearningState = base.state === 'relearning'

  if (isLearningState) {
    if (rating === 'again') {
      return {
        ...base,
        state: 'learning',
        learningStep: 0,
        repetitions: 0,
        intervalDays: 0,
        easeFactor: Math.max(MIN_EASE, base.easeFactor - 0.2),
        lapses: base.lapses + 1,
        dueAt: toIsoAfterMinutes(getStepMinutes('learning', 0)),
        lastReviewedAt: nowIso,
      }
    }

    if (rating === 'hard') {
      const step = Math.max(0, (base.learningStep ?? 0) - 1)
      return {
        ...base,
        state: 'learning',
        learningStep: step,
        dueAt: toIsoAfterMinutes(getStepMinutes('learning', step)),
        lastReviewedAt: nowIso,
      }
    }

    if (rating === 'good') {
      const nextStep = (base.learningStep ?? 0) + 1
      const isGraduating = nextStep >= LEARNING_STEPS_MINUTES.length
      if (isGraduating) {
        return toReviewState(base, nowIso, 1, base.easeFactor)
      }
      return {
        ...base,
        state: 'learning',
        learningStep: nextStep,
        dueAt: toIsoAfterMinutes(getStepMinutes('learning', nextStep)),
        lastReviewedAt: nowIso,
      }
    }

    return toReviewState(base, nowIso, 3, base.easeFactor + 0.15)
  }

  if (isRelearningState) {
    if (rating === 'again') {
      return {
        ...base,
        state: 'relearning',
        learningStep: 0,
        repetitions: Math.max(0, base.repetitions - 1),
        intervalDays: 0,
        easeFactor: Math.max(MIN_EASE, base.easeFactor - 0.2),
        lapses: base.lapses + 1,
        dueAt: toIsoAfterMinutes(getStepMinutes('relearning', 0)),
        lastReviewedAt: nowIso,
      }
    }

    if (rating === 'hard') {
      return {
        ...base,
        state: 'relearning',
        learningStep: 0,
        dueAt: toIsoAfterMinutes(getStepMinutes('relearning', 0)),
        lastReviewedAt: nowIso,
      }
    }

    if (rating === 'good') {
      const nextInterval = Math.max(1, Math.round(Math.max(1, base.intervalDays) * 0.5))
      return toReviewState(base, nowIso, nextInterval, base.easeFactor)
    }

    const nextInterval = Math.max(2, Math.round(Math.max(1, base.intervalDays) * 0.8))
    return toReviewState(base, nowIso, nextInterval, base.easeFactor + 0.15)
  }

  if (rating === 'again') {
    return {
      ...base,
      state: 'relearning',
      learningStep: 0,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: Math.max(MIN_EASE, base.easeFactor - 0.2),
      lapses: base.lapses + 1,
      dueAt: toIsoAfterMinutes(getStepMinutes('relearning', 0)),
      lastReviewedAt: nowIso,
    }
  }

  if (rating === 'hard') {
    const nextInterval =
      base.repetitions <= 1 ? 1 : Math.max(1, Math.round(base.intervalDays * 1.2))

    return {
      ...base,
      ...toReviewState(base, nowIso, nextInterval, Math.max(MIN_EASE, base.easeFactor - 0.15)),
    }
  }

  if (rating === 'good') {
    const nextInterval =
      base.repetitions === 0
        ? 1
        : base.repetitions === 1
          ? 3
          : Math.max(1, Math.round(base.intervalDays * base.easeFactor))

    return {
      ...base,
      ...toReviewState(base, nowIso, nextInterval, base.easeFactor),
    }
  }

  const nextInterval =
    base.repetitions === 0
      ? 3
      : base.repetitions === 1
        ? 6
        : Math.max(1, Math.round(base.intervalDays * base.easeFactor * 1.3))

  return {
    ...base,
    ...toReviewState(base, nowIso, nextInterval, base.easeFactor + 0.15),
  }
}

export const getNextIntervalLabel = (
  current: CardProgress | undefined,
  rating: CardRating,
): string => {
  const next = applySm2Rating(current, rating)
  return toIntervalLabel(next.dueAt)
}
