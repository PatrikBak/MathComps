'use client'

import { usePrevious } from '@mantine/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { SECOND_MS } from '@/components/shared/utils/time-units'
import { useCurrentUrl } from '@/hooks/use-current-url'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'
import { useNow } from '@/hooks/use-now'
import { useRouter } from '@/i18n/navigation'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { AreaRun } from '../model/hosted-competition-state'
import {
  areaTurnAwayKey,
  clockEndsAt,
  derivePhase,
  hasEntryEnded,
  isPracticeGroup,
  readAreaRun,
} from '../model/hosted-competition-state'
import type {
  HostedCompetition,
  HostedCompetitionGroup,
  HostedCompetitionProblem,
} from '../model/hosted-competition-types'
import { COMPETITIONS_LIST_HREF } from '../services/hosted-competition-routes'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { invalidateCompetitionProblems } from './hosted-competition-cache'
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
  /** The run the reader spent here, or null on a closed competition they were never in. */
  run: AreaRun | null
  /** Its problems, in the order it sets them. */
  problems: HostedCompetitionProblem[]
  /** The one instant the whole page is read against, in epoch milliseconds. */
  now: number
  /** Whether the student is graded on this run. */
  isGraded: boolean
}

/**
 * Return type for {@link useCompetitionArea}.
 */
type UseCompetitionAreaResult = PendingArea | ReadyArea

/**
 * One competition as its own area reads it: the set, the entry spent on it, and everything the page says
 * about where that entry stands.
 *
 * Two reads stand behind all of it. A reader with no entry is sent back to the list rather than shown an
 * area with nothing in it, unless the competition has closed: its problems are public from that moment, so
 * anybody may read the set and the official solutions beside it, account or none.
 *
 * @param competitionSlug - Which competition the reader is inside.
 *
 * @returns What the page has to draw, or which read it is still waiting on.
 */
export function useCompetitionArea(competitionSlug: string): UseCompetitionAreaResult {
  // Competitions copy
  const t = useTranslations('competitions')

  // The localized router
  const router = useRouter()

  // The React Query cache, for reading the set again once the clock stops counting
  const queryClient = useQueryClient()

  // Whose answers these are, and whether that is settled yet
  const { readerKey, isReaderKnown } = useEntryReader()

  // The shared sign-in prompt
  const showLoginPrompt = useLoginPromptToast()

  // The page to come back to once signed in
  const getCurrentUrl = useCurrentUrl()

  // The competition, the group setting its terms, and the entry the reader spent on it
  const {
    competitionInGroup,
    entry,
    uiState: viewState,
  } = useAreaEntry(readerKey, isReaderKnown, competitionSlug)

  // When the counted part ends, which nothing but a sat entry has
  const endsAt = clockEndsAt(entry)

  // One clock for the page, so every deadline on it moves on the same tick. An entry given up for the
  // problems has none, and neither does a page still working out what it is showing
  const now = useNow(SECOND_MS, endsAt !== null)

  // Where the group sits in its own life, undefined while the address names no competition the reader
  // can see
  const phase =
    competitionInGroup === undefined ? undefined : derivePhase(competitionInGroup.group, now)

  // Whether the set may be read at all: an entry of their own buys it, and a competition that is over
  // with its problems made public hands it to anybody, account or none. That second way is the only one
  // onto this page without an entry
  const isReadable =
    entry !== null ||
    (competitionInGroup !== undefined &&
      phase === 'closed' &&
      competitionInGroup.competition.problemsPublished)

  // This competition's problems, once there is something entitling the reader to them
  const { problems, uiState: problemsState } = useCompetitionProblems(
    readerKey,
    competitionSlug,
    isReadable
  )

  // Whether the counted part is over, which the page needs before it draws anything as well as after. A
  // reader who never entered has no counted part, and neither has an entry given up for the problems
  const hasEnded = entry !== null && hasEntryEnded(entry, now)

  // Whether the counted part was already over a render ago, which is what tells a clock running out under
  // the page from a page opened after one had
  const wasEnded = usePrevious(hasEnded)

  // Which copy a turning-away carries, one of a handful of keys, so the effect below stands still while
  // the clock ticks under it
  const turnAwayKey = areaTurnAwayKey(phase, readerKey !== null)

  // A reader with nothing to read here, so the list is where they go instead, told why
  useEffect(() => {
    if (viewState.kind !== 'ready' || isReadable) return

    // An account is the whole of what stands in the way, so the way to get one comes with the reason.
    // The address is taken now: by the time the prompt is pressed it names the list below
    if (turnAwayKey === 'areaAuthReason') {
      showLoginPrompt({ reason: t(turnAwayKey), redirectUrl: getCurrentUrl() })
    }
    // Anything else is about where the competition stands, which an account of theirs has no say in
    else {
      toast.warning(t(turnAwayKey))
    }

    // And back to the list either way
    router.replace(COMPETITIONS_LIST_HREF)
  }, [viewState, isReadable, turnAwayKey, router, t, showLoginPrompt, getCurrentUrl])

  // A clock running out under the page opens the official solutions, and nothing was pressed to say so:
  // the set on screen was read while the entry still counted, so it is read again now that it does not.
  // Only on the turn itself. A page opened on an entry already over read the solutions the first time
  useEffect(() => {
    if (hasEnded && wasEnded === false) {
      invalidateCompetitionProblems(queryClient)
    }
  }, [hasEnded, wasEnded, queryClient])

  // Still working out what there is to show, or on the way out
  if (competitionInGroup === undefined || !isReadable) {
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

  // The run the page draws from, or nothing at all where the reader spent no entry here
  const run: AreaRun | null = entry === null ? null : readAreaRun(entry, noteGraceMinutes, now)

  // What the page draws
  return {
    kind: 'ready',
    readerKey,
    group,
    competition,
    run,
    problems,
    now,
    isGraded: !isPracticeGroup(group),
  }
}
