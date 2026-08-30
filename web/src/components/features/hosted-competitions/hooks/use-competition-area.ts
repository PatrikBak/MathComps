'use client'

import { useEffect } from 'react'

import { SECOND_MS } from '@/components/shared/utils/time-units'
import { useNow } from '@/hooks/use-now'
import { useRouter } from '@/i18n/navigation'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { AreaEntry } from '../model/hosted-competition-state'
import { areNotesOpen, hasEntryEnded, isPracticeGroup } from '../model/hosted-competition-state'
import type {
  HostedCompetition,
  HostedCompetitionGroup,
  HostedCompetitionProblem,
} from '../model/hosted-competition-types'
import { COMPETITIONS_LIST_HREF } from '../services/hosted-competition-routes'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { useAreaEntry } from './use-area-entry'
import { useCompetitionProblems } from './use-competition-problems'
import { useEntryReader } from './use-entry-reader'

/**
 * The area while one of the two reads behind it is still out, or once one of them has given up.
 */
type PendingArea = {
  /** The discriminant. */
  kind: 'pending'
  /** How far the read the page is waiting on got. */
  uiState: QueryUiState
  /** Which of the two reads that is, since a failure in each of them says a different thing. */
  waitingOn: 'view' | 'problems'
}

/**
 * Everything the area draws itself from, once both of its reads have landed.
 */
type ReadyArea = {
  /** The discriminant. */
  kind: 'ready'
  /** Whose answers these are, which is what they are cached under. */
  readerKey: HostedCompetitionsReaderKey
  /** The group whose terms the competition runs on. */
  group: HostedCompetitionGroup
  /** The competition itself. */
  competition: HostedCompetition
  /** The entry the student spent on it. */
  entry: AreaEntry
  /** Its problems, in the order it sets them. */
  problems: HostedCompetitionProblem[]
  /** The one instant the whole page is read against, in epoch milliseconds. */
  now: number
  /** When the counted part ends, as an ISO-8601 string; null for an entry that never had a clock. */
  endsAt: string | null
  /** Whether the student is graded on this run. */
  isGraded: boolean
  /** Whether the student closed the entry themselves, which the page says differently from a spent clock. */
  wasHandedIn: boolean
  /** Whether the counted part is over, which changes what the page says and nothing about what it offers. */
  hasEnded: boolean
  /** Whether the student may still say something about their own solutions. */
  areNotesOpen: boolean
}

/**
 * Return type for {@link useCompetitionArea}.
 */
type UseCompetitionAreaResult = PendingArea | ReadyArea

/**
 * One competition as its own area reads it: the set, the entry spent on it, and everything the page says
 * about where that entry stands.
 *
 * Two reads stand behind all of it, and a reader with no entry is sent back to the list rather than shown
 * an area with nothing in it.
 *
 * @param competitionId - Which competition the reader is inside.
 *
 * @returns What the page has to draw, or which read it is still waiting on.
 */
export function useCompetitionArea(competitionId: string): UseCompetitionAreaResult {
  // The localized router, for sending a reader with no entry back where they came from
  const router = useRouter()

  // Whose answers these are, and whether that is settled yet
  const { readerKey, isReaderKnown } = useEntryReader()

  // The competition, the group setting its terms, and the entry the reader spent on it
  const {
    competitionInGroup,
    entry,
    uiState: viewState,
  } = useAreaEntry(readerKey, isReaderKnown, competitionId)

  // Whether there is an entry at all
  const isEntitled = entry !== null

  // When the counted part ended, which nothing but a sat entry has
  const endsAt = entry?.kind === 'sat' ? entry.endsAt : null

  // This competition's problems, once there is an entry to read them through
  const { problems, uiState: problemsState } = useCompetitionProblems(
    readerKey,
    competitionId,
    isEntitled
  )

  // One clock for the page, so every deadline on it moves on the same tick. An entry given up for the
  // problems has none, and neither does a page still working out what it is showing
  const now = useNow(SECOND_MS, endsAt !== null)

  // A reader with no entry has nothing to read here, so the list is where they go instead
  useEffect(() => {
    if (viewState.kind === 'ready' && !isEntitled) {
      router.replace(COMPETITIONS_LIST_HREF)
    }
  }, [viewState, isEntitled, router])

  // Still working out what there is to show, or on the way out
  if (competitionInGroup === undefined || entry === null) {
    return { kind: 'pending', uiState: viewState, waitingOn: 'view' }
  }

  // And on the set itself, which is what the page is for. A page that seated its header the moment the
  // first of the two reads landed would put a spinner high on it and then move it down under the header
  // once the second one did, so both reads stand behind the same one
  if (problems === undefined) {
    return { kind: 'pending', uiState: problemsState, waitingOn: 'problems' }
  }

  // The group setting the terms, the competition itself, and how long past an entry notes are taken
  const { group, competition, noteGraceMinutes } = competitionInGroup

  // Nothing but a sat entry can have been closed early, one given up for the problems never having had
  // a clock to beat
  const wasHandedIn = entry.kind === 'sat' && entry.wasHandedIn

  // What the page draws, every reading of the entry taken against the one clock above
  return {
    kind: 'ready',
    readerKey,
    group,
    competition,
    entry,
    problems,
    now,
    endsAt,
    wasHandedIn,
    isGraded: !isPracticeGroup(group),
    hasEnded: hasEntryEnded(entry, now),
    areNotesOpen: areNotesOpen(entry, noteGraceMinutes, now),
  }
}
