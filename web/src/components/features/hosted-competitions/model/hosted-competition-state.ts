import { assertNever } from '@/components/shared/utils/assert-never'
import { MINUTE_MS } from '@/components/shared/utils/time-units'

import type { HostedCompetition, HostedCompetitionGroup } from './hosted-competition-types'

/**
 * Where a group sits in its own life.
 *
 * Derived from its dates: nothing marks a group open or closed, so its timestamps are the state.
 */
export type GroupPhase = 'practice' | 'upcoming' | 'open' | 'closed'

/**
 * The student has not entered this competition.
 */
type StandingNone = {
  /** The discriminant. */
  kind: 'none'
}

/**
 * The student is inside and their clock is still running.
 */
type StandingRunning = {
  /** The discriminant. */
  kind: 'running'
  /** When the clock runs out. */
  endsAt: string
}

/**
 * The student gave the entry up to read the problems, and never competed in it.
 */
type StandingForfeited = {
  /** The discriminant. */
  kind: 'forfeited'
}

/**
 * The student's entry is over, whether they closed it or the clock did.
 */
type StandingDone = {
  /** The discriminant. */
  kind: 'done'
}

/**
 * Whether a group is the practice one, which is the one that never closes.
 *
 * Nothing marks it as such. A group with no closing date can never be graded, a result needing a moment
 * when everybody is done, and that is what makes the practice one different.
 *
 * @param group - The group being read.
 *
 * @returns Whether it is the practice one.
 */
export function isPracticeGroup(group: HostedCompetitionGroup): boolean {
  return group.closesAt === null
}

/**
 * Where a student stands with one competition.
 */
export type HostedCompetitionStanding =
  | StandingNone
  | StandingRunning
  | StandingForfeited
  | StandingDone

/**
 * Where a group sits in its own life.
 *
 * @param group - The group being read.
 * @param now - The instant to read its dates against, in epoch milliseconds.
 *
 * @returns Its phase.
 */
export function derivePhase(group: HostedCompetitionGroup, now: number): GroupPhase {
  // The practice one is outside the schedule: it opened once and never closes
  if (isPracticeGroup(group)) {
    return 'practice'
  }

  // Announced, and not taking entries yet
  if (Date.parse(group.opensAt) > now) {
    return 'upcoming'
  }

  // Past its window
  if (group.closesAt !== null && Date.parse(group.closesAt) <= now) {
    return 'closed'
  }

  // Inside the window, taking entries
  return 'open'
}

/**
 * Where a student stands with one competition.
 *
 * Nothing marks an entry finished when its clock runs out, so an entry whose end has passed is over by
 * arithmetic.
 *
 * @param group - The group it belongs to, which sets how long its clock runs.
 * @param competition - The competition being read.
 * @param now - The instant to read its entry against, in epoch milliseconds.
 *
 * @returns The student's standing.
 */
export function deriveStanding(
  group: HostedCompetitionGroup,
  competition: HostedCompetition,
  now: number
): HostedCompetitionStanding {
  // The entry, if they have one at all
  const entry = competition.entry

  // Never taken, so the way in is still open
  if (entry === null) {
    return { kind: 'none' }
  }

  // What they did with the entry decides the rest
  switch (entry.kind) {
    // Given up for the problems, so there is no clock to read
    case 'forfeited':
      return { kind: 'forfeited' }

    // Sat, so it is the clock that says whether they are still in it
    case 'sat': {
      // When the clock they were given runs out
      const endsAt = new Date(
        Date.parse(entry.startedAt) + group.clockMinutes * MINUTE_MS
      ).toISOString()

      // Still inside, with time left on the clock
      if (entry.finishedAt === null && Date.parse(endsAt) > now) {
        return { kind: 'running', endsAt }
      }

      // Over, whether they closed it themselves or the clock did
      return { kind: 'done' }
    }

    // Every entry is handled above
    default:
      return assertNever(entry)
  }
}

/**
 * The order the phases are read in, most actionable first and regardless of the calendar.
 */
const PHASE_ORDER: Record<GroupPhase, number> = {
  practice: 0,
  open: 1,
  upcoming: 2,
  closed: 3,
}

/**
 * Puts groups in the order a reader wants them.
 *
 * @param groups - The groups being listed.
 * @param now - The instant their phases are read against, in epoch milliseconds.
 *
 * @returns The groups, most actionable first and newest first within a phase.
 */
export function orderForReading(
  groups: HostedCompetitionGroup[],
  now: number
): HostedCompetitionGroup[] {
  // Sorting a copy, the caller's array being the query cache's own
  return [...groups].sort((left, right) => {
    // What each of them is currently doing
    const byPhase = PHASE_ORDER[derivePhase(left, now)] - PHASE_ORDER[derivePhase(right, now)]

    // Phase first, and the newer of two in the same phase ahead of the older
    return byPhase !== 0 ? byPhase : Date.parse(right.opensAt) - Date.parse(left.opensAt)
  })
}
