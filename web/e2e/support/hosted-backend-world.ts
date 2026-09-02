import type {
  EntryReadiness,
  HostedCompetition,
  HostedCompetitionEntry,
  HostedCompetitionGroup,
  HostedCompetitionsView,
} from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { HOSTED_COMPETITION_CATEGORIES } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { formatMonthAndYear } from '@/components/shared/utils/date-utils'
import { DAY_MS, MINUTE_MS, SECOND_MS } from '@/components/shared/utils/time-units'
import type { LocalizedString } from '@/i18n/i18n'

/**
 * The world a {@link HostedState} opens on: every group the surface lists, the competitions inside each
 * of them, the entry the student holds, and what their account already has.
 */

/** How many problems a competition's set holds. */
export const PROBLEMS_PER_COMPETITION = 3

/** How long a competition's clock runs, in minutes. */
export const CLOCK_MINUTES = 120

/** How long past the end of an entry the fake still takes a note about a solution, in minutes. */
const NOTE_GRACE_MINUTES = 30

/** How long the practice competition's clock runs, in minutes. Short enough to watch it run out. */
const PRACTICE_CLOCK_MINUTES = 1

/** How long a group takes entries for, in days. */
const WINDOW_DAYS = 13

/** The category the entered states put the student inside. */
const ENTERED_CATEGORY_INDEX = 1

/** The competition the specs enter, one of those the open group runs, as English addresses it. */
export const COMPETITION_SLUG = 'open-intermediate'

/**
 * Names one competition in every language.
 *
 * English carries the bare slug and every other language wears its own suffix, the way the real slugs differ
 * per language. Every seeding path names a competition by its English one, so a lookup reading only the
 * reader's own wording finds nothing rather than passing.
 *
 * @param name - The slug English addresses it by.
 *
 * @returns The slug in every language.
 */
function slugsOf(name: string): LocalizedString {
  // The bare name, plus one per other language
  return { sk: `${name}-sk`, cs: `${name}-cs`, en: name }
}

/**
 * Which state the student is in when the page opens.
 *
 * Only what cannot coexist gets a name of its own. Everything a student can hold at the same time as
 * something else is in every one of them at once.
 */
export type HostedState =
  /** Everything an entry needs, and nothing taken yet. */
  | 'ready'
  /** Forty minutes into a two-hour clock. */
  | 'running'
  /** A minute and a half off running out. */
  | 'expiring'
  /** Closed early, an hour ago. */
  | 'finished'
  /** Given up half an hour ago for the problems, so no clock ever ran. */
  | 'forfeited'
  /** Signed up and never named themselves, so the gate has something to hold back. */
  | 'gate-blocked'
  /** Everything in place except the rules, which is a first entry ever. */
  | 'first-entry'

/**
 * What the student did in one group that has closed.
 */
type PastSeed = {
  /** How many days ago it closed. */
  closedDaysAgo: number
  /** Which categories they entered, by index. */
  entries: number[]
  /** Whether their results have been published. */
  resultsPublished: boolean
}

/**
 * Every group behind the open one, newest first.
 *
 * Written out rather than generated, the point being the states they cover: two categories taken in one
 * group, results published and results still being written, and one group skipped entirely.
 */
const PAST_SEEDS: PastSeed[] = [
  { closedDaysAgo: 21, entries: [0, 1], resultsPublished: false },
  { closedDaysAgo: 52, entries: [1], resultsPublished: true },
  { closedDaysAgo: 83, entries: [2], resultsPublished: true },
  { closedDaysAgo: 114, entries: [], resultsPublished: true },
]

/**
 * Builds an entry that ran its full clock and was closed at the end of it.
 *
 * @param endedAtMs - When it ended, in epoch milliseconds.
 *
 * @returns The entry.
 */
function pastEntry(endedAtMs: number): HostedCompetitionEntry {
  // A clock that ran its full length, so it started one whole clock before it ended
  return {
    kind: 'sat',
    startedAt: new Date(endedAtMs - CLOCK_MINUTES * MINUTE_MS).toISOString(),
    finishedAt: new Date(endedAtMs).toISOString(),
  }
}

/**
 * Builds the entry a state puts on the open group.
 *
 * @param state - Which state to build.
 * @param now - The instant the times are measured from, in epoch milliseconds.
 *
 * @returns The entry, or null for a state nobody has entered in.
 */
function openEntry(state: HostedState, now: number): HostedCompetitionEntry | null {
  // Only a state that has spent an entry puts one on the group
  switch (state) {
    // Forty minutes in, with most of the clock still to run
    case 'running':
      return {
        kind: 'sat',
        startedAt: new Date(now - 40 * MINUTE_MS).toISOString(),
        finishedAt: null,
      }

    // A minute and a half off running out
    case 'expiring':
      return {
        kind: 'sat',
        startedAt: new Date(now - CLOCK_MINUTES * MINUTE_MS + 90 * SECOND_MS).toISOString(),
        finishedAt: null,
      }

    // Closed early, an hour ago
    case 'finished':
      return pastEntry(now - 60 * MINUTE_MS)

    // Given up half an hour ago for the problems, so no clock was ever started
    case 'forfeited':
      return { kind: 'forfeited', forfeitedAt: new Date(now - 30 * MINUTE_MS).toISOString() }

    // Every other state leaves it untouched
    case 'ready':
    case 'gate-blocked':
    case 'first-entry':
      return null

    // Every state is handled above
    default:
      return assertNever(state)
  }
}

/**
 * Builds one group's competitions, one per category.
 *
 * @param groupId - Which group they belong to.
 * @param entryFor - The entry each category carries, by index.
 * @param resultsPublished - Whether their results have been published.
 * @param problemsPublished - Whether their problems can be read, which only a closed group's can.
 *
 * @returns One competition per category.
 */
function buildCompetitions(
  groupId: string,
  entryFor: (index: number) => HostedCompetitionEntry | null,
  resultsPublished: boolean,
  problemsPublished: boolean
): HostedCompetition[] {
  // One competition per category, all of them on the same terms
  return HOSTED_COMPETITION_CATEGORIES.map((category, index) => ({
    slug: slugsOf(`${groupId}-${category}`),
    category,
    entry: entryFor(index),
    resultsPublished,
    problemsPublished,
  }))
}

/**
 * Builds the single competition a specially named group runs.
 *
 * @param groupId - Which group it belongs to.
 * @param entry - The entry it carries, if any.
 * @param resultsPublished - Whether its results have been published.
 * @param problemsPublished - Whether its problems can be read.
 *
 * @returns The one competition, which carries no category: the group's own name says who it is for.
 */
function buildSoloCompetition(
  groupId: string,
  entry: HostedCompetitionEntry | null,
  resultsPublished: boolean,
  problemsPublished: boolean
): HostedCompetition[] {
  // The one competition, named after its group since no category tells it apart
  return [
    { slug: slugsOf(`${groupId}-set`), category: null, entry, resultsPublished, problemsPublished },
  ]
}

/**
 * Names a group after the month it opens in, which is what most of them are called.
 *
 * Written from the dates rather than fixed, so they move with the clock instead of drifting behind it.
 *
 * @param opensAtMs - When the group opens, in epoch milliseconds.
 *
 * @returns The name, in every language.
 */
function monthNames(opensAtMs: number): LocalizedString {
  // The instant the month is read off
  const instant = new Date(opensAtMs).toISOString()

  // The same month, written the way each language writes it
  return {
    sk: formatMonthAndYear(instant, 'sk'),
    cs: formatMonthAndYear(instant, 'cs'),
    en: formatMonthAndYear(instant, 'en'),
  }
}

/**
 * Builds everything the surface reads for a state.
 *
 * @param state - Which state to build.
 *
 * @returns Every group, in the order they are listed.
 */
export function buildView(state: HostedState): HostedCompetitionsView {
  // The moment every time on the page is measured from
  const now = Date.now()

  // A student on their very first visit has taken nothing at all
  const isNewcomer = state === 'first-entry'

  // The practice one, which never closes and never publishes results
  const practice: HostedCompetitionGroup = {
    id: 'practice',
    name: { sk: 'Skúšobná súťaž', cs: 'Zkušební soutěž', en: 'Practice competition' },
    problemCount: PROBLEMS_PER_COMPETITION,
    clockMinutes: PRACTICE_CLOCK_MINUTES,
    opensAt: new Date(now - 200 * DAY_MS).toISOString(),
    closesAt: null,
    competitions: buildSoloCompetition('practice', null, false, false),
  }

  // One the program named itself rather than after a month, running a single competition
  const preparationOpensAt = now + 9 * DAY_MS
  const preparation: HostedCompetitionGroup = {
    id: 'preparation',
    name: {
      sk: 'Príprava na celoštátne kolo A',
      cs: 'Příprava na celostátní kolo A',
      en: 'National round A preparation',
    },
    problemCount: PROBLEMS_PER_COMPETITION,
    clockMinutes: CLOCK_MINUTES,
    opensAt: new Date(preparationOpensAt).toISOString(),
    closesAt: new Date(preparationOpensAt + WINDOW_DAYS * DAY_MS).toISOString(),
    competitions: buildSoloCompetition('preparation', null, false, false),
  }

  // The one announced but not started
  const upcomingOpensAt = now + 24 * DAY_MS
  const upcoming: HostedCompetitionGroup = {
    id: 'upcoming',
    name: monthNames(upcomingOpensAt),
    problemCount: PROBLEMS_PER_COMPETITION,
    clockMinutes: CLOCK_MINUTES,
    opensAt: new Date(upcomingOpensAt).toISOString(),
    closesAt: new Date(upcomingOpensAt + WINDOW_DAYS * DAY_MS).toISOString(),
    competitions: buildCompetitions('upcoming', () => null, false, false),
  }

  // The one taking entries, plus whatever the state put on it
  const openOpensAt = now - 6 * DAY_MS
  const open: HostedCompetitionGroup = {
    id: 'open',
    name: monthNames(openOpensAt),
    problemCount: PROBLEMS_PER_COMPETITION,
    clockMinutes: CLOCK_MINUTES,
    opensAt: new Date(openOpensAt).toISOString(),
    closesAt: new Date(openOpensAt + WINDOW_DAYS * DAY_MS).toISOString(),
    competitions: buildCompetitions(
      'open',
      (index) => (index === ENTERED_CATEGORY_INDEX ? openEntry(state, now) : null),
      false,
      false
    ),
  }

  // A specially named one taking entries right now
  const openSpecialOpensAt = now - 3 * DAY_MS
  const openSpecial: HostedCompetitionGroup = {
    id: 'open-special',
    name: {
      sk: 'Príprava na krajské kolo A',
      cs: 'Příprava na krajské kolo A',
      en: 'Regional round A preparation',
    },
    problemCount: PROBLEMS_PER_COMPETITION,
    clockMinutes: CLOCK_MINUTES,
    opensAt: new Date(openSpecialOpensAt).toISOString(),
    closesAt: new Date(openSpecialOpensAt + WINDOW_DAYS * DAY_MS).toISOString(),
    competitions: buildSoloCompetition('open-special', openEntry(state, now), false, false),
  }

  // And one that is over, sat by everybody but the newcomer
  const closedSpecialClosedAt = now - 34 * DAY_MS
  const closedSpecial: HostedCompetitionGroup = {
    id: 'closed-special',
    name: {
      sk: 'Príprava na školské kolo A',
      cs: 'Příprava na školní kolo A',
      en: 'School round A preparation',
    },
    problemCount: PROBLEMS_PER_COMPETITION,
    clockMinutes: CLOCK_MINUTES,
    opensAt: new Date(closedSpecialClosedAt - WINDOW_DAYS * DAY_MS).toISOString(),
    closesAt: new Date(closedSpecialClosedAt).toISOString(),
    competitions: buildSoloCompetition(
      'closed-special',
      isNewcomer ? null : pastEntry(closedSpecialClosedAt - 3 * DAY_MS),
      true,
      true
    ),
  }

  // Everything behind them
  const past: HostedCompetitionGroup[] = PAST_SEEDS.map((seed) => {
    // The fortnight it took entries in, counted back from the day it closed
    const closedAt = now - seed.closedDaysAgo * DAY_MS
    const opensAt = closedAt - WINDOW_DAYS * DAY_MS

    // What its competitions are named after
    const id = `past-${seed.closedDaysAgo}`

    // The group, named after the month it opened in
    return {
      id,
      name: monthNames(opensAt),
      problemCount: PROBLEMS_PER_COMPETITION,
      clockMinutes: CLOCK_MINUTES,
      opensAt: new Date(opensAt).toISOString(),
      closesAt: new Date(closedAt).toISOString(),
      competitions: buildCompetitions(
        id,
        (index) => {
          // A newcomer has nothing behind them, and neither does a category they sat out
          return isNewcomer || !seed.entries.includes(index)
            ? // Nothing on that category
              null
            : // The entry they sat, two days before the group closed
              pastEntry(closedAt - 2 * DAY_MS)
        },
        seed.resultsPublished,
        true
      ),
    }
  })

  // Every group there is to show, on the terms the whole program runs on
  return {
    groups: [practice, preparation, upcoming, open, openSpecial, closedSpecial, ...past],
    noteGraceMinutes: NOTE_GRACE_MINUTES,
  }
}

/**
 * Builds the readiness a state starts from.
 *
 * @param state - Which state to build.
 *
 * @returns Whether the student has what an entry needs of them.
 */
export function buildReadiness(state: HostedState): EntryReadiness {
  // What each state leaves the student holding
  switch (state) {
    // Signed up and never named themselves, so the gate has something to hold back
    case 'gate-blocked':
      return {
        hasUsername: false,
        hasAnsweredGraduation: true,
        hasEmail: false,
        hasAcceptedRules: true,
        hasHiddenProfilePrompt: false,
      }

    // Everything in place except the rules, which is a first entry ever
    case 'first-entry':
      return {
        hasUsername: true,
        hasAnsweredGraduation: true,
        hasEmail: true,
        hasAcceptedRules: false,
        hasHiddenProfilePrompt: false,
      }

    // Every other state is ready to enter
    case 'ready':
    case 'running':
    case 'expiring':
    case 'finished':
    case 'forfeited':
      return {
        hasUsername: true,
        hasAnsweredGraduation: true,
        hasEmail: true,
        hasAcceptedRules: true,
        hasHiddenProfilePrompt: false,
      }

    // Every state is handled above
    default:
      return assertNever(state)
  }
}
