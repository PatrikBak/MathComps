import { assertNever } from '@/components/shared/utils/assert-never'
import { HOUR_MINUTES, MINUTE_MS, SECOND_MS } from '@/components/shared/utils/time-units'
import { SUPPORTED_LOCALES } from '@/i18n/i18n'

import type {
  HostedCompetition,
  HostedCompetitionEntry,
  HostedCompetitionGroup,
  HostedCompetitionsView,
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
 * A spent entry with {@link entryEndsAt} and {@link wasHandedInEarly} already applied, so whatever is
 * handed one gets the instant and not the arithmetic behind it.
 *
 * Its two arms are the two ways an entry can be spent, and they differ in one thing: whether there is a
 * clock the turns are counted against. Both read the same problems under the same terms.
 */
export type AreaEntry = SatAreaEntry | ForfeitedAreaEntry

/**
 * A sat entry as the area reads it, with where one instant leaves the clock it runs on.
 */
type SatAreaRun = SatAreaEntry & {
  /** Whether the counted part is over, which closes the hand-in and changes what the page says. */
  hasEnded: boolean
  /** Whether the student may still say something about their own solutions. */
  areNotesOpen: boolean
}

/**
 * The entry a student spent here, carrying every reading of it the page needs, all taken against the one
 * instant the page is drawn at. Stands in for an {@link AreaEntry} wherever one is wanted.
 *
 * Only a sat entry has anything read off it. A forfeit ran no clock, so the entry itself is the whole of
 * what the area holds about one.
 */
export type AreaRun = SatAreaRun | ForfeitedAreaEntry

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
 * Whether the counted part of an entry is over.
 *
 * A hand-in settles it outright, whatever is left on the clock. Otherwise it is the clock, read to within
 * its last second: that is the boundary the reading on screen stands on, and read any finer the sentence
 * and the countdown disagree for a frame. An entry given up for the problems never had a clock, so there
 * is nothing of it to be over.
 *
 * @param entry - The entry the student spent.
 * @param now - The instant to read it against, in epoch milliseconds.
 *
 * @returns Whether it has ended.
 */
export function hasEntryEnded(entry: AreaEntry, now: number): boolean {
  // Nothing was sat, so there is no counted part to end
  if (entry.kind === 'forfeited') {
    return false
  }

  // Closed by the student, or by a clock down to its last second
  return entry.wasHandedIn || Date.parse(entry.endsAt) - now < SECOND_MS
}

/**
 * Whether a student may still leave a note about their own solutions to a competition's problems.
 *
 * An entry given up for the problems was never a run, so nothing was argued in it to speak about; one that
 * was sat stays open for the grace that follows its end.
 *
 * @param entry - The entry the student spent.
 * @param graceMinutes - How long past the end of the entry notes are still taken.
 * @param now - The instant to read it against, in epoch milliseconds.
 *
 * @returns Whether notes are still being taken.
 */
export function areNotesOpen(entry: AreaEntry, graceMinutes: number, now: number): boolean {
  // Nothing was sat, so there is nothing of theirs to say anything about; and what was sat runs out once
  // the grace behind its end does
  return entry.kind !== 'forfeited' && Date.parse(entry.endsAt) + graceMinutes * MINUTE_MS > now
}

/**
 * When a spent entry stops counting.
 *
 * @param entry - The entry the student spent, or null where they spent none.
 *
 * @returns The instant as an ISO-8601 string, or null wherever no clock of theirs runs.
 */
export function clockEndsAt(entry: AreaEntry | null): string | null {
  // Nothing spent here, so there is no clock to end
  if (entry === null) {
    return null
  }

  switch (entry.kind) {
    // The end its clock runs to
    case 'sat':
      return entry.endsAt

    // Given up for the problems, so no clock ever ran to end
    case 'forfeited':
      return null

    // Every entry is handled above
    default:
      return assertNever(entry)
  }
}

/**
 * Reads a spent entry into what one competition's own area draws from, with everything the clock decides
 * settled against a single instant.
 *
 * @param entry - The entry the student spent.
 * @param graceMinutes - How long past the end of the entry notes are still taken.
 * @param now - The instant to read it against, in epoch milliseconds.
 *
 * @returns The entry, with what the clock decides on it already settled.
 */
export function readAreaRun(entry: AreaEntry, graceMinutes: number, now: number): AreaRun {
  switch (entry.kind) {
    // A clock ran on it, so where it stands and whether notes are still taken both follow from it
    case 'sat':
      return {
        ...entry,
        hasEnded: hasEntryEnded(entry, now),
        areNotesOpen: areNotesOpen(entry, graceMinutes, now),
      }

    // No clock ran on it, so there is nothing to read that the entry does not already say
    case 'forfeited':
      return entry

    // Every entry is handled above
    default:
      return assertNever(entry)
  }
}

/**
 * One competition and the group whose terms it runs on, which is what locating one in the view hands back.
 */
export type CompetitionInGroup = {
  /** The group it runs in. */
  group: HostedCompetitionGroup
  /** The competition itself. */
  competition: HostedCompetition
  /** How long past the end of an entry notes are still taken, in minutes; the program's own term. */
  noteGraceMinutes: number
}

/**
 * The competitions-copy keys a turning-away is worded by: a sentence of its own, or, for
 * `areaAuthReason`, what the account is for, which the shared login wording wraps.
 */
export type AreaTurnAwayKey =
  | 'areaUnknown'
  | 'areaNotOpen'
  | 'areaNotStarted'
  | 'areaNotPublic'
  | 'areaAuthReason'

/**
 * What the area says when it turns a reader away.
 *
 * A phase is a reason on its own where the address leads nowhere, or where signing in would not help. A
 * competition already over is the second of those: its set is public or held back for everybody alike.
 * Where one is still taking entries the account is what the reader is missing first, a competition being
 * neither started nor read without one.
 *
 * @param phase - Where the group sits in its own life, undefined when the address names no competition.
 * @param isSignedIn - Whether the reader has the account an entry is taken with.
 *
 * @returns The copy key naming why the reader is being sent to the list.
 */
export function areaTurnAwayKey(
  phase: GroupPhase | undefined,
  isSignedIn: boolean
): AreaTurnAwayKey {
  switch (phase) {
    // Nothing of that name is on this reader's list, so the address leads nowhere they can go
    case undefined:
      return 'areaUnknown'

    // Announced, and taking nobody's entry yet
    case 'upcoming':
      return 'areaNotOpen'

    // Taking entries, so the reader is not in it yet rather than shut out of it, once they have the
    // account that taking one needs
    case 'open':
    // And the practice one takes them for as long as it exists, which is the same standing
    case 'practice':
      return isSignedIn ? 'areaNotStarted' : 'areaAuthReason'

    // Over, so the set is open to anybody and the only thing left to turn a reader away is problems
    // whose embargo outlived the competition
    case 'closed':
      return 'areaNotPublic'

    // Every phase is handled above
    default:
      return assertNever(phase)
  }
}

/**
 * Whether one competition is the one a slug addresses.
 *
 * Read against every language it is named in, the same way the server resolves one, since a link is pasted
 * between readers who read the site in different languages.
 *
 * @param competition - The competition being asked about.
 * @param competitionSlug - What arrived addressing one.
 *
 * @returns Whether the slug addresses this competition.
 */
export function isCompetitionAddressedBy(
  competition: HostedCompetition,
  competitionSlug: string
): boolean {
  // One name per language, any of which can be the one that arrived
  return SUPPORTED_LOCALES.some((locale) => competition.slug[locale] === competitionSlug)
}

/**
 * Finds one competition in the view, along with the group whose terms it runs on. A competition is named on
 * its own everywhere a reader arrives at one, while everything about how it runs sits on its group.
 *
 * @param view - Every group the reader can see, undefined while the read has not landed.
 * @param competitionSlug - Which competition to find.
 *
 * @returns The competition and its group, or undefined when the view holds no such competition.
 */
export function findCompetitionInGroup(
  view: HostedCompetitionsView | undefined,
  competitionSlug: string
): CompetitionInGroup | undefined {
  // Nothing has arrived, so there is nothing to find it in
  if (view === undefined) {
    return undefined
  }

  // The one competition of that name, wherever in the groups it sits
  const found = view.groups
    .flatMap((group) => group.competitions.map((competition) => ({ group, competition })))
    .find((candidate) => isCompetitionAddressedBy(candidate.competition, competitionSlug))

  // With the terms the whole program runs on, which is where the note window is set
  return found === undefined ? undefined : { ...found, noteGraceMinutes: view.noteGraceMinutes }
}

/**
 * Reads a spent entry the way everything about one of its problems reads it, the arithmetic over the
 * group's clock already done.
 *
 * @param group - The group it belongs to, which sets how long its clock runs.
 * @param entry - The entry the student spent, null while they have spent none.
 *
 * @returns The entry, or null when there is none to read.
 */
export function toAreaEntry(
  group: HostedCompetitionGroup,
  entry: HostedCompetitionEntry | null
): AreaEntry | null {
  // Nothing spent, so there is nothing to read it against
  if (entry === null) {
    return null
  }

  // What they did with the entry decides which of them this is
  switch (entry.kind) {
    // Given up for the problems, so no clock ever started
    case 'forfeited':
      return { kind: 'forfeited' }

    // Sat, so it carries where its counted part ended and whether the student ended it themselves
    case 'sat':
      return {
        kind: 'sat',
        endsAt: entryEndsAt(group, entry),
        wasHandedIn: wasHandedInEarly(group, entry),
      }

    // Every entry is handled above
    default:
      return assertNever(entry)
  }
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
 * @returns The groups, most actionable first, then by when each of them opens.
 */
export function orderForReading(
  groups: HostedCompetitionGroup[],
  now: number
): HostedCompetitionGroup[] {
  // Sorting a copy, the caller's array being the query cache's own
  return [...groups].sort((left, right) => {
    // What each of them is currently doing
    const phase = derivePhase(left, now)
    const byPhase = PHASE_ORDER[phase] - PHASE_ORDER[derivePhase(right, now)]

    // Phase decides it wherever the two differ
    if (byPhase !== 0) return byPhase

    // Two still to come read soonest first, since the one being waited for is the next to happen.
    // Everywhere else the newer leads: a competition that just closed is the one still being talked
    // about, and the one before it matters less the further back it goes.
    return phase === 'upcoming'
      ? Date.parse(left.opensAt) - Date.parse(right.opensAt)
      : Date.parse(right.opensAt) - Date.parse(left.opensAt)
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
