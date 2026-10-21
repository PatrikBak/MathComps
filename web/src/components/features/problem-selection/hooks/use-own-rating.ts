'use client'

import { useDebouncedCallback } from '@mantine/hooks'
import { useState } from 'react'

import { useKeyedState } from '@/hooks/use-keyed-state'

import type { Proposal, RatingAspect, RatingScores } from '../model/selection-types'
import { useRate } from './use-proposal-writes'

/** How long a score a key sets waits for the next key before it is written, in milliseconds. */
const KEY_WRITE_DELAY_MS = 300

/**
 * Return type for {@link useOwnRating}.
 */
type UseOwnRatingResult = {
  /**
   * The reader's score for each aspect as they last set it, none where they have given none: a score keys set is
   * shown while it waits to be written, and a score written while the selection catches up with it.
   */
  scores: RatingScores
  /** Sets the reader's score for one aspect at once, keeping the others'; null takes it back. */
  setScore: (aspect: RatingAspect, score: number | null) => void
  /**
   * Sets the reader's score for one aspect from a key, keeping the others'; null takes it back. Written once the
   * keys stop coming, or the moment the rating leaves the screen.
   */
  setKeyScore: (aspect: RatingAspect, score: number | null) => void
}

/**
 * The reader's own rating of a problem and the ways to set it. A held key sets a score many times a second, so the
 * scores keys set wait for the keys to stop and go out as one write. Every write carries every aspect, so a score
 * set while another waits goes out with it.
 *
 * @param proposal - The problem rated.
 *
 * @returns The reader's scores and the ways to set them.
 */
export function useOwnRating(proposal: Proposal): UseOwnRatingResult {
  // The reader's rating of the problem as the selection holds it, if they have rated it
  const ownRating = proposal.ratings.find((rating) => rating.isOwn)

  // The scores keys have set that no write has carried yet, none while nothing waits. Kept through any move of the
  // selection's rating, since dropping them would lose scores no write has sent
  const [waiting, setWaiting] = useState<RatingScores | null>(null)

  // The scores the last write carried, dropped once the selection's rating moves
  const [written, setWritten] = useKeyedState<RatingScores | null>(ownRating, null)

  // The reader's scores as they last set them
  const scores: RatingScores = waiting ??
    written ?? {
      beauty: ownRating?.beauty ?? null,
      difficulty: ownRating?.difficulty ?? null,
    }

  // Rating the problem, or taking the rating back
  const rate = useRate()

  // A function which writes the scores
  const write = (next: RatingScores) => {
    // Nothing left waiting, this write carrying it
    setWaiting(null)

    // The scores shown until the selection's rating moves
    setWritten(next)

    // The scores, written
    rate.mutate({ proposalId: proposal.id, scores: next })
  }

  // A function which writes the scores keys have set, once the keys stop coming or the rating leaves the screen
  const sendWaiting = useDebouncedCallback(
    () => {
      // The scores waiting, written
      if (waiting !== null) write(waiting)
    },
    { delay: KEY_WRITE_DELAY_MS, flushOnUnmount: true }
  )

  // A function which writes one aspect's score at once, the others' as last set
  const setScore = (aspect: RatingAspect, score: number | null) =>
    write({ ...scores, [aspect]: score })

  // A function which sets one aspect's score from a key, writing it once the keys stop coming
  const setKeyScore = (aspect: RatingAspect, score: number | null) => {
    // The scores as last set, this aspect's moved
    setWaiting({ ...scores, [aspect]: score })

    // The scores written once the keys stop
    sendWaiting()
  }

  // The reader's scores and the ways to set them
  return { scores, setScore, setKeyScore }
}
