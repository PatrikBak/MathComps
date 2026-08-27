import { assertNever } from '@/components/shared/utils/assert-never'
import { HOUR_MINUTES, MINUTE_MS } from '@/components/shared/utils/time-units'

import type {
  HostedCompetition,
  HostedCompetitionGroup,
  SatEntry,
} from './hosted-competition-types'

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
 * An entry the student sat, whose clock decides which of their turns count towards it.
 */
type SatAreaEntry = {
  /** The discriminant. */
  kind: 'sat'
  /** When the entry stops counting, as an ISO-8601 string. */
  endsAt: string
  /** Whether the student closed the entry themselves rather than letting the clock close it. */
  wasHandedIn: boolean
}

/**
 * An entry the student gave up for the problems, so no clock ever ran on it.
 */
type ForfeitedAreaEntry = {
  /** The discriminant. */
  kind: 'forfeited'
}

/**
 * A spent entry as everything inside the area reads it: {@link entryEndsAt} and {@link wasHandedInEarly}
 * already applied, so a problem panel or a conversation is handed the instant and not the arithmetic
 * behind it.
 *
 * Its two arms are the two ways an entry can be spent, and they differ in one thing: whether there is a
 * clock the turns are counted against. Both read the same problems under the same terms.
 */
export type AreaEntry = SatAreaEntry | ForfeitedAreaEntry

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
 * When a sat entry's clock would run out on its own, whatever the student did about it.
 *
 * @param group - The group it belongs to, which sets how long its clock runs.
 * @param entry - The entry the student sat.
 *
 * @returns The instant, in epoch milliseconds.
 */
function clockRunsOutAtMs(group: HostedCompetitionGroup, entry: SatEntry): number {
  // The clock starts when the student does, not when the group opens
  return Date.parse(entry.startedAt) + group.clockMinutes * MINUTE_MS
}

/**
 * Whether the student closed a sat entry themselves rather than letting its clock close it.
 *
 * The stamp alone does not say: a backend is free to write one when the clock runs out too, and a screen
 * that reads any stamp as a hand-in tells a student they gave up time they actually spent. What separates
 * them is whether the entry ended before the clock would have.
 *
 * @param group - The group it belongs to, which sets how long its clock runs.
 * @param entry - The entry the student sat.
 *
 * @returns Whether they handed it in early.
 */
export function wasHandedInEarly(group: HostedCompetitionGroup, entry: SatEntry): boolean {
  // Closed, and closed before the clock would have closed it
  return entry.finishedAt !== null && Date.parse(entry.finishedAt) < clockRunsOutAtMs(group, entry)
}

/**
 * When a sat entry stopped counting: the clock running out, or the student handing it in ahead of that.
 *
 * Kept apart from the standing, which drops it the moment the clock is spent while a surface that lets a
 * student keep going unranked still has to say where the counted part ended.
 *
 * @param group - The group it belongs to, which sets how long its clock runs.
 * @param entry - The entry the student sat.
 *
 * @returns The instant it ends, as an ISO-8601 string.
 */
export function entryEndsAt(group: HostedCompetitionGroup, entry: SatEntry): string {
  // Where its own clock would have put it
  const clockRunsOutAt = clockRunsOutAtMs(group, entry)

  // A student who closed the entry themselves ended it there, and the time they left on the clock is not
  // time anything of theirs can still count in
  const endsAt =
    entry.finishedAt === null
      ? clockRunsOutAt
      : Math.min(clockRunsOutAt, Date.parse(entry.finishedAt))

  // Whichever came first
  return new Date(endsAt).toISOString()
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
      const endsAt = entryEndsAt(group, entry)

      // Still inside, with time left on the clock. Closing the entry is asked about separately, the stamp
      // saying so being enough on its own: it can sit ahead of the clock this is read against, a browser
      // and whatever wrote the stamp never agreeing to the second, and an entry the student has closed
      // must not read as one they are still sitting
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

/**
 * How a running clock says how much of itself is left.
 */
export type ClockDisplayMode = 'minutes' | 'closing' | 'final'

/**
 * How much of the clock is left when it starts counting in seconds.
 */
const CLOSING_BELOW_MS = 5 * MINUTE_MS

/**
 * How much of the clock is left when it stops being something a student can still act on.
 */
const FINAL_BELOW_MS = MINUTE_MS

/**
 * Decides how precisely a running clock should say how much is left.
 *
 * Minutes for almost all of it, since a rounded reading is all there is to act on. Seconds from five
 * minutes out, which is where the decision turns from the problem to whether there is time to write it
 * up. Under a minute nothing is left to decide, and the reading is a deadline.
 *
 * @param remainingMs - How much of the clock is left, in milliseconds.
 *
 * @returns Which way to say it.
 */
export function clockDisplayMode(remainingMs: number): ClockDisplayMode {
  // The deadline itself
  if (remainingMs < FINAL_BELOW_MS) {
    return 'final'
  }

  // The part where the seconds are the decision
  return remainingMs < CLOSING_BELOW_MS ? 'closing' : 'minutes'
}

/**
 * How a minutes-mode reading breaks down.
 */
export type ClockMinutesLeft = {
  /** Whole hours left, counting a clock longer than a day in hours rather than losing the days. */
  hours: number
  /** The minutes left over those hours. */
  minutes: number
}

/**
 * Breaks a clock's remainder down for a minutes-mode reading, rounded up.
 *
 * Up, a countdown saying how long there is left rather than how much whole time has yet to pass: a
 * two-hour entry would otherwise read `1 h 59 min` the instant the student presses the button.
 *
 * @param remainingMs - How much of the clock is left, in milliseconds.
 *
 * @returns The reading.
 */
export function clockMinutesLeft(remainingMs: number): ClockMinutesLeft {
  // Every part-minute counted as a whole one
  const totalMinutes = Math.ceil(Math.max(0, remainingMs) / MINUTE_MS)

  // Broken into hours and the minutes over them
  return {
    hours: Math.floor(totalMinutes / HOUR_MINUTES),
    minutes: totalMinutes % HOUR_MINUTES,
  }
}

/**
 * How much of the minute a rounded reading stands on is still to run, as a fraction of one.
 *
 * A reading counted in whole minutes holds still for a minute at a time, and a student meeting it in the
 * first of those cannot tell a running clock from a stopped one. This is the remainder the rounding
 * hides, so something can be drawn moving while the number waits its turn.
 *
 * The minute and not the whole entry: over a two-hour clock the same reading drawn once end to end moves
 * a sixth of a pixel a second, and holds just as still as the number it was drawn to answer.
 *
 * @param remainingMs - How much of the clock is left, in milliseconds.
 *
 * @returns How much of the current minute is left, from one down to zero.
 */
export function clockMinuteFraction(remainingMs: number): number {
  // Whatever is left, with a clock read past its own end counted as spent
  const left = Math.max(0, remainingMs)

  // The minute the reading is standing on, off the same rounding the reading uses so the two change
  // on the same tick
  const minutesLeft = Math.ceil(left / MINUTE_MS)

  // How far into that minute the clock has run
  return 1 - (minutesLeft * MINUTE_MS - left) / MINUTE_MS
}
