'use client'

import { useSearchParams } from 'next/navigation'

import { delay } from '@/components/shared/utils/async-utils'
import { formatMonthAndYear } from '@/components/shared/utils/date-utils'
import { DAY_MS, MINUTE_MS, SECOND_MS } from '@/components/shared/utils/time-units'
import type { LocalizedString } from '@/i18n/i18n'
import type { ApiResult } from '@/types/api'

import type {
  EntryReadiness,
  HostedCompetition,
  HostedCompetitionEntry,
  HostedCompetitionGroup,
  HostedCompetitionsView,
} from '../model/hosted-competition-types'
import { HOSTED_COMPETITION_CATEGORIES } from '../model/hosted-competition-types'

/**
 * Which set of facts the mocked backend answers with.
 *
 * The screen exists before the tables do, so the states a student can be in are chosen from the URL rather
 * than reached by living through them. Read off `?scenario=` and gone the moment the real service lands.
 *
 * Only what cannot coexist gets a scenario of its own; every past state shows up in all of them at once.
 */
export type HostedCompetitionScenario =
  | 'ready'
  | 'running'
  | 'expiring'
  | 'finished'
  | 'forfeited'
  | 'gate-blocked'
  | 'first-entry'

/** Every scenario, for reading one off a query string. */
const SCENARIOS: HostedCompetitionScenario[] = [
  'ready',
  'running',
  'expiring',
  'finished',
  'forfeited',
  'gate-blocked',
  'first-entry',
]

/** The scenario a visitor with nothing in the URL gets. */
const DEFAULT_SCENARIO: HostedCompetitionScenario = 'ready'

/** How long the mocked calls take to answer, so the waiting states are the ones a reader actually sees. */
const RESPONSE_DELAY_MS = 350

/** How many problems a competition's set holds. */
const PROBLEMS_PER_COMPETITION = 3

/** How long a competition's clock runs, in minutes. */
const CLOCK_MINUTES = 120

/** How long the practice competition's clock runs, in minutes. */
const PRACTICE_CLOCK_MINUTES = 45

/** How long a group takes entries for, in days. */
const WINDOW_DAYS = 13

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

/** The category the entered scenarios put the student inside. */
const ENTERED_CATEGORY_INDEX = 1

/**
 * The mocked backend's memory: what one scenario currently holds.
 */
type HostedCompetitionMockState = {
  /** Every group, in the order they are listed. */
  view: HostedCompetitionsView
  /** Whether the student has what an entry needs of them. */
  readiness: EntryReadiness
}

/**
 * What each scenario has answered so far.
 *
 * Held per scenario and built on first ask, so entering a competition sticks across a refetch and switching
 * scenarios never rewrites what another one was showing.
 */
const scenarioStates = new Map<HostedCompetitionScenario, HostedCompetitionMockState>()

/**
 * Reads a scenario name off a query string value.
 *
 * @param value - Whatever `?scenario=` carried.
 *
 * @returns The named scenario, or the default when the value names none.
 */
function parseScenario(value: string | undefined): HostedCompetitionScenario {
  // An unrecognized name falls back rather than blanking the page
  return SCENARIOS.find((scenario) => scenario === value) ?? DEFAULT_SCENARIO
}

/**
 * Who the page should treat as reading it.
 *
 * `student` stands in for a sign-in the mocked backend has no way to perform, `anonymous` stands in for a
 * sign-out, and `real` leaves the question to Clerk.
 */
type HostedCompetitionViewer = 'real' | 'student' | 'anonymous'

/**
 * The value `?scenario=` carries to be shown the page as a visitor with no account.
 *
 * It exists because a browser already holding a Clerk session shows the signed-in page however many
 * scenarios it is given.
 */
export const ANONYMOUS_SCENARIO = 'signed-out'

/**
 * Who the query string asked to be shown the page as.
 *
 * Naming a scenario is asking to be shown one particular student's page, so it stands in for a sign-in.
 * Naming {@link ANONYMOUS_SCENARIO} asks for the opposite, and naming nothing leaves it to Clerk.
 *
 * @param value - Whatever `?scenario=` carried.
 *
 * @returns Who to treat as reading.
 */
function parseViewer(value: string | undefined): HostedCompetitionViewer {
  // The one name that asks for no account at all
  if (value === ANONYMOUS_SCENARIO) {
    return 'anonymous'
  }

  // Any other known name stands in for that student, and anything else leaves the question alone
  return SCENARIOS.some((scenario) => scenario === value) ? 'student' : 'real'
}

/**
 * Who the address asks to be shown the page as, and which student it names.
 */
export type MockViewer = {
  /** Who to treat as reading: a mocked student, a visitor with no account, or whoever Clerk says. */
  viewer: HostedCompetitionViewer
  /** Which set of facts the page is built against. */
  scenario: HostedCompetitionScenario
}

/**
 * Whatever `?scenario=` carries, read straight off the address.
 *
 * For use inside a call rather than a render, a query function running in the browser where the address is
 * simply there to be read.
 *
 * @returns The name asked for, or undefined off the browser and when nothing was asked for.
 */
function askedScenario(): string | undefined {
  // The server has no address to read
  if (typeof window === 'undefined') {
    return undefined
  }

  // Whatever the address carries, if anything
  return new URLSearchParams(window.location.search).get('scenario') ?? undefined
}

/**
 * Which set of facts to answer with right now.
 *
 * @returns The scenario the address asks for.
 */
function currentScenario(): HostedCompetitionScenario {
  return parseScenario(askedScenario())
}

/**
 * Who the address asks to be shown the page as.
 *
 * A hook rather than a plain read, because it is called while rendering: reading the address off the
 * browser answers differently on the server, and hands a page one thing to hydrate and another to draw.
 *
 * @returns Who to treat as reading, and which of the mocked students they are.
 */
export function useMockViewer(): MockViewer {
  // Whatever the address carries
  const searchParams = useSearchParams()
  const named = searchParams?.get('scenario') ?? undefined

  // One name answers both: who is reading, and which student they are
  return { viewer: parseViewer(named), scenario: parseScenario(named) }
}

/**
 * Builds an entry that ended some time ago.
 *
 * @param endedAtMs - When it ended, in epoch milliseconds.
 *
 * @returns The entry.
 */
function pastEntry(endedAtMs: number): HostedCompetitionEntry {
  // A full clock that ran to its end and was closed there
  return {
    kind: 'sat',
    startedAt: new Date(endedAtMs - CLOCK_MINUTES * MINUTE_MS).toISOString(),
    finishedAt: new Date(endedAtMs).toISOString(),
  }
}

/**
 * Builds an entry that was given up rather than sat.
 *
 * @param forfeitedAtMs - When it was given up, in epoch milliseconds.
 *
 * @returns The entry.
 */
function forfeitedEntry(forfeitedAtMs: number): HostedCompetitionEntry {
  // The moment it was given up
  const forfeitedAt = new Date(forfeitedAtMs).toISOString()

  // Given up rather than sat, so no clock was ever started
  return { kind: 'forfeited', forfeitedAt }
}

/**
 * Builds the entry the entered scenarios put on the open group.
 *
 * @param scenario - Which set of facts to build.
 * @param now - The instant the times are measured from, in epoch milliseconds.
 *
 * @returns The entry, or null for a scenario nobody has entered in.
 */
function openEntry(
  scenario: HostedCompetitionScenario,
  now: number
): HostedCompetitionEntry | null {
  switch (scenario) {
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
      return forfeitedEntry(now - 30 * MINUTE_MS)

    // Every other scenario leaves it untouched
    case 'ready':
    case 'gate-blocked':
    case 'first-entry':
      return null
  }
}

/**
 * Builds one group's competitions, one per category.
 *
 * @param groupId - Which group they belong to.
 * @param opensAtMs - When the group opens, in epoch milliseconds.
 * @param entryFor - The entry each category carries, by index.
 * @param resultsPublished - Whether their results have been published.
 * @param problemsPublished - Whether their problems can be read, which only a closed group's can.
 *
 * @returns One competition per category.
 */
function buildCompetitions(
  groupId: string,
  opensAtMs: number,
  entryFor: (index: number) => HostedCompetitionEntry | null,
  resultsPublished: boolean,
  problemsPublished: boolean
): HostedCompetition[] {
  // One competition per category, all of them on the same terms
  return HOSTED_COMPETITION_CATEGORIES.map((category, index) => ({
    id: `${groupId}-${category}`,
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
  return [{ id: `${groupId}-set`, category: null, entry, resultsPublished, problemsPublished }]
}

/**
 * Names a group after the month it opens in, which is what most of them are called.
 *
 * A real group carries whatever name it was given; these are written from the dates, so they move with
 * them instead of drifting behind.
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
 * Builds everything the surface reads for a scenario.
 *
 * @param scenario - Which set of facts to build.
 *
 * @returns Every group, in the order they are listed.
 */
function buildView(scenario: HostedCompetitionScenario): HostedCompetitionsView {
  // The moment every time on the page is measured from
  const now = Date.now()

  // A student on their very first visit has taken nothing at all
  const isNewcomer = scenario === 'first-entry'

  // The practice one, which never closes and is never graded
  const practice: HostedCompetitionGroup = {
    id: 'practice',
    name: { sk: 'Skúšobná súťaž', cs: 'Zkušební soutěž', en: 'Practice competition' },
    problemCount: PROBLEMS_PER_COMPETITION,
    clockMinutes: PRACTICE_CLOCK_MINUTES,
    opensAt: new Date(now - 200 * DAY_MS).toISOString(),
    closesAt: null,
    competitions: buildSoloCompetition('practice', null, false, false),
  }

  // The one taking entries, plus whatever the scenario put on it
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
      openOpensAt,
      (index) => (index === ENTERED_CATEGORY_INDEX ? openEntry(scenario, now) : null),
      false,
      false
    ),
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
    competitions: buildCompetitions('upcoming', upcomingOpensAt, () => null, false, false),
  }

  // One the program named itself rather than after a month, running a single competition: its name already
  // says who it is pitched at, so there is no level to choose between
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
    competitions: buildSoloCompetition('open-special', openEntry(scenario, now), false, false),
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
      name: monthNames(opensAt),
      problemCount: PROBLEMS_PER_COMPETITION,
      clockMinutes: CLOCK_MINUTES,
      id,
      opensAt: new Date(opensAt).toISOString(),
      closesAt: new Date(closedAt).toISOString(),
      competitions: buildCompetitions(
        id,
        opensAt,
        (index) => {
          // Whether they entered this category at all, and nothing at all for a newcomer
          const wasEntered = seed.entries.includes(index)

          // A newcomer has nothing behind them, and neither does a category they sat out
          return isNewcomer || !wasEntered ? null : pastEntry(closedAt - 2 * DAY_MS)
        },
        seed.resultsPublished,
        true
      ),
    }
  })

  // Every group there is to show
  return { groups: [practice, preparation, upcoming, open, openSpecial, closedSpecial, ...past] }
}

/**
 * Builds the readiness a scenario starts from.
 *
 * @param scenario - Which set of facts to build.
 *
 * @returns Whether the student has what an entry needs of them.
 */
function buildReadiness(scenario: HostedCompetitionScenario): EntryReadiness {
  switch (scenario) {
    // Signed up and never named themselves, so the gate has something to hold back
    case 'gate-blocked':
      return {
        nickname: null,
        graduationYear: 2028,
        hasVerifiedEmail: false,
        hasAcceptedRules: true,
      }

    // Everything in place except the rules, which is a first entry ever
    case 'first-entry':
      return {
        nickname: 'aleph',
        graduationYear: 2028,
        hasVerifiedEmail: true,
        hasAcceptedRules: false,
      }

    // Every other scenario is ready to enter
    case 'ready':
    case 'running':
    case 'expiring':
    case 'finished':
    case 'forfeited':
      return {
        nickname: 'aleph',
        graduationYear: 2028,
        hasVerifiedEmail: true,
        hasAcceptedRules: true,
      }
  }
}

/**
 * The scenario's current state, built on the first ask.
 *
 * @param scenario - Which set of facts to reach.
 *
 * @returns What the scenario currently holds.
 */
function stateOf(scenario: HostedCompetitionScenario): HostedCompetitionMockState {
  // What the scenario has answered so far
  const existing = scenarioStates.get(scenario)

  // Anything already built keeps whatever has been done to it
  if (existing !== undefined) {
    return existing
  }

  // Otherwise build the scenario's starting facts and remember them
  const created = { view: buildView(scenario), readiness: buildReadiness(scenario) }
  scenarioStates.set(scenario, created)

  // The scenario's starting facts
  return created
}

/**
 * Reads every group a student can see.
 *
 * @returns The competitions view, as the API would report it.
 */
export async function fetchHostedCompetitionsView(): Promise<ApiResult<HostedCompetitionsView>> {
  // Let the waiting states be seen
  await delay(RESPONSE_DELAY_MS)

  // The scenario's view as it currently stands
  return { success: true, data: stateOf(currentScenario()).view }
}

/**
 * Reads whether the student has what an entry needs of them.
 *
 * @returns The student's readiness, as the API would report it.
 */
export async function fetchEntryReadiness(): Promise<ApiResult<EntryReadiness>> {
  // Let the waiting states be seen
  await delay(RESPONSE_DELAY_MS)

  // The scenario's readiness as it currently stands
  return { success: true, data: stateOf(currentScenario()).readiness }
}

/**
 * Takes the student's entry into one competition: the clock starts and, on a first entry ever, the rules
 * are accepted along with it.
 *
 * @param competitionId - Which competition is being entered.
 *
 * @returns The entry that was created, as the API would report it.
 */
export async function enterHostedCompetition(
  competitionId: string
): Promise<ApiResult<HostedCompetitionEntry>> {
  // Let the pressed button hold its spinner
  await delay(RESPONSE_DELAY_MS)

  // The competition being entered
  const state = stateOf(currentScenario())
  const competition = state.view.groups
    .flatMap((group) => group.competitions)
    .find((candidate) => candidate.id === competitionId)

  // A competition nobody can find is a failure the caller surfaces like any other
  if (competition === undefined) {
    return { success: false, error: { message: 'Unknown competition', statusCode: 404 } }
  }

  // The clock starts now and runs for as long as this competition sets
  const startedAt = Date.now()
  const entry: HostedCompetitionEntry = {
    kind: 'sat',
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: null,
  }

  // Hold the entry, and the acceptance the press carried with it
  competition.entry = entry
  state.readiness.hasAcceptedRules = true

  // The entry the press created
  return { success: true, data: entry }
}

/**
 * Gives the student's entry up: the problems open to them and no clock is ever started. It spends the
 * entry exactly as sitting it would.
 *
 * @param competitionId - Which competition is being given up.
 *
 * @returns The entry that was created, as the API would report it.
 */
export async function forfeitHostedCompetition(
  competitionId: string
): Promise<ApiResult<HostedCompetitionEntry>> {
  // Let the pressed button hold its spinner
  await delay(RESPONSE_DELAY_MS)

  // The competition being given up
  const state = stateOf(currentScenario())
  const competition = state.view.groups
    .flatMap((group) => group.competitions)
    .find((candidate) => candidate.id === competitionId)

  // A competition nobody can find is a failure the caller surfaces like any other
  if (competition === undefined) {
    return { success: false, error: { message: 'Unknown competition', statusCode: 404 } }
  }

  // Spent, and over in the same instant
  const entry = forfeitedEntry(Date.now())

  // Hold the entry, and the acceptance the press carried with it
  competition.entry = entry
  state.readiness.hasAcceptedRules = true

  // The entry the press created
  return { success: true, data: entry }
}
