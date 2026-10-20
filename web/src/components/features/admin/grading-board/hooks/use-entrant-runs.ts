import { useMemo, useState } from 'react'

import { SECOND_MS } from '@/components/shared/utils/time-units'
import { useNow } from '@/hooks/use-now'

import { type EntrantRun, entrantRun, IS_RUN_LIVE } from '../model/entrant-run'
import type { GradingBoard, GradingCompetition } from '../model/grading-types'

/** Stands in for the runs while there is no competition to read them off. */
const NO_RUNS = new Map<string, never>()

/**
 * Options for {@link useEntrantRuns}.
 */
type UseEntrantRunsOptions = {
  /** The board, which sets how long entries run and how long a note stays open; null until it has been read. */
  board: GradingBoard | null
  /** The competition on screen; null while there is none. */
  competition: GradingCompetition | null
}

/**
 * Where each entrant of the competition on screen stands on their own run, kept current as clocks and note windows
 * run out.
 *
 * The tick runs only while somebody on screen is not done yet, so a board read once everybody is done holds still.
 * A read bringing in somebody not done yet starts it again.
 *
 * @param options - The board and the competition on screen.
 *
 * @returns Each entrant's run, by user.
 */
export function useEntrantRuns({
  board,
  competition,
}: UseEntrantRunsOptions): ReadonlyMap<string, EntrantRun> {
  // Whether the tick is running
  const [isTicking, setIsTicking] = useState(false)

  // The current instant, as of the last tick
  const now = useNow(SECOND_MS, isTicking)

  // Each entrant's run, by user
  const runs = useMemo(
    () =>
      board === null || competition === null
        ? NO_RUNS
        : new Map(
            competition.entrants.map((entrant) => [
              entrant.user.id,
              entrantRun(entrant, board, now),
            ])
          ),
    [board, competition, now]
  )

  // Whether anybody on screen still has something to come
  const hasLiveRun = [...runs.values()].some((run) => IS_RUN_LIVE[run.kind])

  // The tick running exactly while anybody on screen may still write
  if (hasLiveRun !== isTicking) {
    // Started for a run still going, stopped once the last one is done
    setIsTicking(hasLiveRun)
  }

  // The runs as of the last tick
  return runs
}
