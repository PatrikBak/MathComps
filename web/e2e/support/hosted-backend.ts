import type { Page, Route } from '@playwright/test'

import type {
  DefenseCopy,
  DefenseLimits,
  DefenseSession,
  DefenseSessionList,
  DefenseSessionListItem,
  MathildaConsent,
  StoredTurn,
} from '@/components/features/defense/model/defense-types'
import {
  entryEndsAt,
  isCompetitionAddressedBy,
  isPracticeGroup,
} from '@/components/features/hosted-competitions/model/hosted-competition-state'
import type {
  EntryReadiness,
  HostedCompetition,
  HostedCompetitionEntry,
  HostedCompetitionGroup,
  HostedCompetitionProblem,
  HostedCompetitionsView,
  SpentEntry,
} from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { HOSTED_COMPETITION_CATEGORIES } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { formatMonthAndYear } from '@/components/shared/utils/date-utils'
import { DAY_MS, MINUTE_MS, SECOND_MS } from '@/components/shared/utils/time-units'
import type { LocalizedString } from '@/i18n/i18n'

import { BACKEND_ORIGIN } from './backend-routes'

/**
 * A backend for the competitions surface that answers out of memory instead of a database.
 *
 * The surface is one of the few the archive cannot stand in for: every state a student can be in is a row
 * somebody had to create, and reaching them for real means applying drafts, declaring a group and holding a
 * conversation with a live examiner that answers differently every run. Standing in for the API instead gives
 * each test the one state it is about, and makes the examiner's replies something an assertion can name.
 *
 * It holds real state rather than replaying fixtures: an entry taken in one call is there in the next read,
 * and a turn sent is in the transcript that comes back. That is what lets a test press a button and then
 * assert on what the page does with the answer, reloads included.
 */

/** How many problems a competition's set holds. */
const PROBLEMS_PER_COMPETITION = 3

/** How long a competition's clock runs, in minutes. */
const CLOCK_MINUTES = 120

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

/** {@link PROBLEMS_PER_COMPETITION}, as the specs read it. */
export const PROBLEM_COUNT = PROBLEMS_PER_COMPETITION

/**
 * How long the fake takes to answer, so the waiting states are the ones a reader actually sees.
 *
 * A test that needs to catch a spinner needs the spinner to exist for longer than the assertion takes to
 * arrive; one that does not is slowed by exactly this much per call, which is why it is small.
 */
const RESPONSE_DELAY_MS = 200

/**
 * The longest the runner waits for the page's clock to live through {@link RESPONSE_DELAY_MS}.
 *
 * A held clock is not walked forward by anything the fake does, so without this a spec that pauses and
 * then asserts would hang here rather than failing on the assertion it is about. It has to stay well
 * under the timeout the specs give their own assertions: a ceiling above that one answers the call
 * after the assertion it was holding up has already given up, and the failure then names a missing
 * divider rather than a reply that never came.
 */
const THINKING_CEILING_MS = 5_000

/**
 * How often the page's clock is read while a call is being held open.
 *
 * Each read is a round trip into the page, and so is the `fastForward` that ends the wait. Reading
 * every few milliseconds contends with it, and a paused clock then stays paused long enough for the
 * reply to miss its own assertion.
 */
const POLL_INTERVAL_MS = 200

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
 * What to vary about the student beyond the state they are in.
 */
export type HostedBackendOptions = {
  /**
   * Whether they have already been told what talking to Mathilda entails. Defaults to true, since every
   * spec about the chat needs to be past that gate to reach a composer at all.
   */
  hasConsented?: boolean

  /**
   * A note the student already left about their first solution in every competition, so a state whose entry
   * is long over still has one to read back. Absent while they have left none.
   */
  standingNote?: string
}

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
 * The statements a competition sets, in the order it sets them.
 *
 * Real typeset maths rather than filler, since what these exercise is a student reading a problem and
 * arguing about it.
 */
const STATEMENTS: LocalizedString[] = [
  {
    sk: 'Nájdite všetky dvojice kladných celých čísel $(a, b)$ také, že $a^2 + b$ aj $b^2 + a$ sú druhé mocniny celých čísel.',
    cs: 'Najděte všechny dvojice kladných celých čísel $(a, b)$ takové, že $a^2 + b$ i $b^2 + a$ jsou druhé mocniny celých čísel.',
    en: 'Find all pairs of positive integers $(a, b)$ such that both $a^2 + b$ and $b^2 + a$ are perfect squares.',
  },
  {
    sk: 'Nech $ABC$ je ostrouhlý trojuholník s výškami $AD$, $BE$ a $CF$. Dokážte, že priamka $EF$ je kolmá na priamku $AO$, kde $O$ je stred opísanej kružnice trojuholníka $ABC$.',
    cs: 'Nechť $ABC$ je ostroúhlý trojúhelník s výškami $AD$, $BE$ a $CF$. Dokažte, že přímka $EF$ je kolmá na přímku $AO$, kde $O$ je střed kružnice opsané trojúhelníku $ABC$.',
    en: 'Let $ABC$ be an acute triangle with altitudes $AD$, $BE$ and $CF$. Prove that the line $EF$ is perpendicular to the line $AO$, where $O$ is the circumcentre of triangle $ABC$.',
  },
  {
    sk: 'Na tabuli je napísaných $n$ jednotiek. V každom kroku zmažeme dve čísla $x$ a $y$ a napíšeme namiesto nich $\\frac{x + y}{4}$. Pre ktoré $n$ vieme dosiahnuť, aby na tabuli zostalo jediné číslo aspoň $\\frac{1}{n}$?',
    cs: 'Na tabuli je napsáno $n$ jedniček. V každém kroku smažeme dvě čísla $x$ a $y$ a napíšeme místo nich $\\frac{x + y}{4}$. Pro která $n$ dokážeme docílit, aby na tabuli zbylo jediné číslo alespoň $\\frac{1}{n}$?',
    en: 'The number $1$ is written on a board $n$ times. At each step we erase two numbers $x$ and $y$ and write $\\frac{x + y}{4}$ in their place. For which $n$ can we make the single remaining number at least $\\frac{1}{n}$?',
  },
]

/**
 * The official solution to each of {@link STATEMENTS}, in the order the competition sets them.
 *
 * Real arguments, since what these exercise is a student reading one back once their entry is over.
 */
const SOLUTIONS: LocalizedString[] = [
  {
    sk: 'Bez ujmy na všeobecnosti nech $a \\le b$. Potom $b^2 < b^2 + a$ a zároveň $b^2 + a \\le b^2 + b < (b+1)^2$, takže $b^2 + a$ leží ostro medzi dvoma susednými druhými mocninami. Taká dvojica teda neexistuje.',
    cs: 'Bez újmy na obecnosti nechť $a \\le b$. Pak $b^2 < b^2 + a$ a zároveň $b^2 + a \\le b^2 + b < (b+1)^2$, takže $b^2 + a$ leží ostře mezi dvěma sousedními druhými mocninami. Taková dvojice tedy neexistuje.',
    en: 'Assume without loss of generality that $a \\le b$. Then $b^2 < b^2 + a$ and $b^2 + a \\le b^2 + b < (b+1)^2$, so $b^2 + a$ lies strictly between two consecutive squares. No such pair exists.',
  },
  {
    sk: 'Body $B$, $C$, $E$, $F$ ležia na kružnici s priemerom $BC$, takže $\\angle AFE = \\angle ACB$. Dotyčnica k opísanej kružnici v bode $A$ zviera s $AB$ ten istý uhol, takže je rovnobežná s $EF$. Keďže $OA$ je na túto dotyčnicu kolmá, je kolmá aj na $EF$.',
    cs: 'Body $B$, $C$, $E$, $F$ leží na kružnici s průměrem $BC$, takže $\\angle AFE = \\angle ACB$. Tečna ke kružnici opsané v bodě $A$ svírá s $AB$ tentýž úhel, takže je rovnoběžná s $EF$. Protože $OA$ je na tuto tečnu kolmá, je kolmá i na $EF$.',
    en: 'The points $B$, $C$, $E$, $F$ lie on the circle with diameter $BC$, so $\\angle AFE = \\angle ACB$. The tangent to the circumcircle at $A$ makes the same angle with $AB$, hence it is parallel to $EF$. Since $OA$ is perpendicular to that tangent, it is perpendicular to $EF$.',
  },
  {
    sk: 'Sledujme súčet čísel na tabuli. Krok nahrádzajúci $x$ a $y$ číslom $\\frac{x+y}{4}$ ho zmenší presne o $\\frac{3(x+y)}{4}$, takže súčet nikdy nerastie. Odtiaľ sa dá ohraničiť posledné číslo a dopočítať, pre ktoré $n$ je hranica $\\frac{1}{n}$ ešte dosiahnuteľná.',
    cs: 'Sledujme součet čísel na tabuli. Krok nahrazující $x$ a $y$ číslem $\\frac{x+y}{4}$ jej zmenší přesně o $\\frac{3(x+y)}{4}$, takže součet nikdy neroste. Odtud lze omezit poslední číslo a dopočítat, pro která $n$ je hranice $\\frac{1}{n}$ ještě dosažitelná.',
    en: 'Follow the sum of the numbers on the board. A step replacing $x$ and $y$ by $\\frac{x+y}{4}$ decreases it by exactly $\\frac{3(x+y)}{4}$, so the sum never grows. That bounds the final number, and the bound settles which $n$ can still reach $\\frac{1}{n}$.',
  },
]

/** The examiner's opening line, which the backend serves and every transcript starts on. */
export const OPENER =
  'Tell me how you approached this one. Start wherever your argument starts, not where the problem does.'

/**
 * What the examiner says next, cycled by how many turns the student has spent.
 *
 * A fake cannot argue, so these probe without claiming to have read anything. They are also what an
 * assertion names, which a live examiner could never be.
 */
const SCRIPTED_REPLIES = [
  'That is a step, but it is not yet a reason. What forces it to hold rather than merely happen to?',
  'Take the case you skipped over. Does the same argument survive it, or does it need a second idea?',
  'You are asserting the bound. Show me where it comes from, in one line if you can.',
  'Good. Now the other direction: what would have to be true for this to fail?',
]

/** The caps every defense here is held to, standing in for the deployment's own setup. */
export const LIMITS: DefenseLimits = {
  maxCandidateChars: 4000,
  maxFeedbackCommentChars: 1000,
  maxMessagesPerDefense: 20,
}

/**
 * Everything one page's fake backend currently holds.
 *
 * One of these per installed fake, so two tests running side by side never write over each other and a
 * reload finds what the call before it left.
 */
type FakeState = {
  /** Every group, in the order they are listed. */
  view: HostedCompetitionsView
  /** Whether the student has what an entry needs of them. */
  readiness: EntryReadiness
  /** Each problem's conversations, most recently active first, by problem id. */
  transcripts: Map<string, DefenseSession[]>
  /** What the student left about each solution, by problem id, for the ones they have said anything about. */
  assessments: Map<string, string>
  /** How many ids have been minted, so nothing collides with anything minted before it. */
  minted: number
}

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
function buildView(state: HostedState): HostedCompetitionsView {
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
function buildReadiness(state: HostedState): EntryReadiness {
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

/**
 * Names one problem of one competition's set.
 *
 * @param competitionSlug - Which competition the set belongs to.
 * @param position - Where the problem sits in it, counting from one.
 *
 * @returns The problem's id.
 */
function problemIdOf(competitionSlug: string, position: number): string {
  // Named after the competition it belongs to, so two sets never collide
  return `${competitionSlug}-p${position}`
}

/**
 * Builds a stored turn.
 *
 * @param state - The state minting its id.
 * @param role - Who authored it.
 * @param content - What it says.
 * @param atMs - When it was authored, in epoch milliseconds.
 *
 * @returns The turn.
 */
function storedTurn(
  state: FakeState,
  role: StoredTurn['role'],
  content: string,
  atMs: number
): StoredTurn {
  // A number no turn before it took
  state.minted++

  // The turn, wearing that number
  return { id: `turn-${state.minted}`, createdAt: new Date(atMs).toISOString(), role, content }
}

/**
 * The conversations held against one problem, opened empty on first ask.
 *
 * @param state - The fake's memory.
 * @param problemId - Which problem's conversations.
 *
 * @returns The conversations, most recently active first.
 */
function transcriptsOf(state: FakeState, problemId: string): DefenseSession[] {
  // What is already there
  const existing = state.transcripts.get(problemId)

  // A problem already argued about hands back what it holds
  if (existing !== undefined) {
    return existing
  }

  // One nobody has argued about yet starts with nothing
  const opened: DefenseSession[] = []

  // Which is what it holds from here
  state.transcripts.set(problemId, opened)

  // And what this ask and every later one reads
  return opened
}

/**
 * Builds one competition's problem set, with whatever has been said about each.
 *
 * @param state - The fake's memory.
 * @param competitionSlug - Which competition's set.
 * @param isSolutionOpen - Whether the set may carry its official solutions.
 *
 * @returns The problems, in the order the competition sets them.
 */
function buildProblems(
  state: FakeState,
  competitionSlug: string,
  isSolutionOpen: boolean
): HostedCompetitionProblem[] {
  // One problem per statement, as many of them as a competition sets
  return STATEMENTS.slice(0, PROBLEMS_PER_COMPETITION).map((statement, index) => {
    // Where it sits in the set
    const position = index + 1

    // The id the problem is named by
    const id = problemIdOf(competitionSlug, position)

    // A row per conversation, saying enough to tell it from the others and no more
    const defenses = transcriptsOf(state, id).map((session) => ({
      sessionId: session.id,
      startedAt: session.turns[0]?.createdAt ?? new Date(0).toISOString(),
    }))

    // The problem, with whatever has been said about it and whatever the student claims of their own
    // solution
    return {
      id,
      position,
      statement,
      solution: isSolutionOpen ? (SOLUTIONS[index] ?? null) : null,
      defenses,
      selfAssessment: state.assessments.get(id) ?? null,
      maxCommentChars: LIMITS.maxFeedbackCommentChars,
    }
  })
}

/**
 * Mirrors the rule the real backend serves an official solution under: it is open unless the student has a
 * clock of their own still running.
 *
 * @param entry - The entry the student holds here, null while they hold none.
 * @param clockMinutes - How long a clock in this group runs, in minutes.
 * @param now - The instant to read the clock against, in epoch milliseconds.
 *
 * @returns Whether the set may carry its solutions.
 */
function isSolutionOpen(
  entry: HostedCompetitionEntry | null,
  clockMinutes: number,
  now: number
): boolean {
  // No entry at all, so this is a competition read after it closed; and one given up for the problems never
  // ran a clock to protect
  if (entry === null || entry.kind === 'forfeited') {
    return true
  }

  // Closed by the student, whatever they left on the clock
  if (entry.finishedAt !== null) {
    return true
  }

  // Otherwise the clock says it
  return Date.parse(entry.startedAt) + clockMinutes * MINUTE_MS <= now
}

/**
 * The group one competition runs in, which is what sets the clock its entry is measured by.
 *
 * @param state - The fake's memory.
 * @param competitionSlug - Which competition's group.
 *
 * @returns The group, or undefined when nothing holds that competition.
 */
function groupOf(state: FakeState, competitionSlug: string): HostedCompetitionGroup | undefined {
  // The first group holding it is the only one
  return state.view.groups.find((group) =>
    group.competitions.some((competition) => isCompetitionAddressedBy(competition, competitionSlug))
  )
}

/** The season every conversation in the library reads as having been set in. */
const LIBRARY_SEASON_START_YEAR = 2026

/**
 * Builds the cross-problem list the library reads: every conversation the fake holds, most recently
 * spoken in first, each named the way the backend names one.
 *
 * Walked from the groups rather than from the transcripts alone, since naming a conversation takes the
 * competition it was set in and a problem id says only which problem.
 *
 * @param state - The fake's memory.
 *
 * @returns The conversations, most recently active first.
 */
function buildLibrary(state: FakeState): DefenseSessionListItem[] {
  // Every conversation of every problem of every competition, named by where it was set
  const competitionItems = state.view.groups.flatMap((group) =>
    group.competitions.flatMap((competition) =>
      Array.from({ length: PROBLEMS_PER_COMPETITION }, (_unused, index) => index + 1).flatMap(
        (position) => libraryItemsOf(state, group, competition.slug.en, position)
      )
    )
  )

  // Most recently spoken in first, the handout one oldest so the competition rows lead
  return [...competitionItems, HANDOUT_ITEM].sort((first, second) =>
    second.lastActivityAt.localeCompare(first.lastActivityAt)
  )
}

/**
 * A conversation held about a handout the site no longer carries, so a spec can tell a control a graded
 * conversation is refused from one the list has lost altogether.
 */
const HANDOUT_ITEM: DefenseSessionListItem = {
  id: 'session-handout',
  target: { kind: 'handout', handoutContentId: 'gone', environmentId: 'gone-1' },
  statement: 'Prove that every positive integer has a unique factorisation into primes.',
  lastActivityAt: new Date(0).toISOString(),
  lastStudentMessage:
    'Induction on the size of the number, with the smallest prime factor peeled off.',
  isGraded: false,
}

/**
 * Builds the list rows for one problem's conversations.
 *
 * @param state - The fake's memory.
 * @param group - The group the competition runs in, which is what names it.
 * @param competitionSlug - The competition the problem belongs to.
 * @param position - Where the problem sits in the set, counting from one.
 *
 * @returns One row per conversation held about that problem.
 */
function libraryItemsOf(
  state: FakeState,
  group: HostedCompetitionGroup,
  competitionSlug: string,
  position: number
): DefenseSessionListItem[] {
  // The problem the rows are about
  const problemId = problemIdOf(competitionSlug, position)

  // A row per conversation, named the way the backend names one
  return transcriptsOf(state, problemId).map((session) => ({
    id: session.id,
    target: {
      kind: 'problem' as const,
      problemId,
      competitionSlug,
      slug: problemId,
      source: {
        season: { slug: '76', displayName: 'Edition 76 (2026/2027)', fullName: null },
        startYear: LIBRARY_SEASON_START_YEAR,
        competition: [
          { slug: 'mc', displayName: 'MathComps', fullName: null },
          { slug: competitionSlug, displayName: group.name.en, fullName: null },
        ],
        number: position,
      },
    },
    statement: STATEMENTS[position - 1]?.en ?? '',
    lastActivityAt: session.turns.at(-1)?.createdAt ?? new Date(0).toISOString(),
    lastStudentMessage:
      session.turns.findLast((turn) => turn.role === 'candidate')?.content ?? null,
    isGraded: !isPracticeGroup(group),
  }))
}

/**
 * What the page's own clock reads, which a spec holding it still has moved on from the runner's.
 *
 * Every instant stamped while a call is being answered has to come from here. A turn stamped off the
 * runner's clock lands before a buzzer the page has already walked past, and the transcript then reads
 * as though the reply beat a deadline it did not. What the fake lays out before it answers anything is
 * measured on the runner's clock, which is the only one there is at that point.
 *
 * @param page - The page whose clock to read.
 *
 * @returns The instant, in epoch milliseconds.
 */
async function pageNow(page: Page): Promise<number> {
  // The page's own clock, read inside it
  try {
    return await page.evaluate(() => Date.now())
  } catch {
    // A page mid-navigation has no clock to read, and the runner's is then the closest thing there is
    return Date.now()
  }
}

/**
 * Answers a route with a JSON body, after the delay every call takes.
 *
 * The delay is served by the page rather than the runner, so a spec that holds the clock still decides
 * when the answer lands: that window between a turn being sent and its reply arriving is exactly what
 * the specs about the buzzer are about.
 *
 * @param page - The page the call came from.
 * @param route - The call to answer.
 * @param body - What to answer with.
 */
async function answer(page: Page, route: Route, body: unknown): Promise<void> {
  // Take as long over the answer as every call takes
  await think(page)

  // Hand the body back
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

/**
 * Holds a call open for as long as every call takes to answer, measured on the page's clock.
 *
 * Its own step because the two defense handlers stamp on both sides of it: the student's turn where it
 * reached the backend, the reply where the examiner finished writing it. Collapsing the two onto one
 * instant is what would let a turn sent with time to spare land the wrong side of the buzzer.
 *
 * It watches the page's clock rather than sleeping on a timer inside the page. A spec that pauses the
 * clock and then walks it forward is exactly the case these calls exist for, and an in-page timer
 * awaited from here never fires: the page is blocked on this very request, so the wait and the thing
 * that would end it are the same event loop. The real-time ceiling is what keeps a spec that pauses the
 * clock and never advances it from hanging here instead of failing on its own assertion.
 *
 * @param page - The page whose clock the wait runs on.
 */
async function think(page: Page): Promise<void> {
  // Where the page's clock stood when the call arrived
  const from = await pageNow(page)

  // And where the runner's clock stood, which is what bounds the wait
  const realFrom = Date.now()

  // Until the page has lived through the delay, or the runner has waited far longer than one
  while (Date.now() - realFrom < THINKING_CEILING_MS) {
    // Where the page's clock stands now, or the runner's when the page has gone away mid-call
    const now = await pageNow(page)

    // Long enough on the page's own clock
    if (now - from >= RESPONSE_DELAY_MS) {
      return
    }

    // Otherwise look again shortly, on the runner's clock, which nothing under test can hold
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

/**
 * Finds one competition wherever its group sits.
 *
 * @param state - The fake's memory.
 * @param competitionSlug - Which competition to find.
 *
 * @returns The competition, or undefined when nothing is addressed by that slug.
 */
function competitionIn(state: FakeState, competitionSlug: string): HostedCompetition | undefined {
  // The first match is the only one
  return state.view.groups
    .flatMap((group) => group.competitions)
    .find((candidate) => isCompetitionAddressedBy(candidate, competitionSlug))
}

/**
 * Seeds the conversation an entered competition's first problem opens with.
 *
 * It straddles the end of the clock, so the boundary between what the clock covered and what it did not
 * is there to look at on arrival rather than only after somebody waits a two-hour clock out. Only the
 * first problem gets one: the rest are what a spec writes into itself.
 *
 * @param state - The fake's memory.
 * @param group - The group setting the terms the clock runs on.
 * @param competition - The competition whose entry it is placed around.
 */
function seedStraddlingDefense(
  state: FakeState,
  group: HostedCompetitionGroup,
  competition: HostedCompetition
): void {
  // Only an entry the student actually sat has a clock to have said anything inside
  if (competition.entry?.kind !== 'sat') {
    return
  }

  // The instant the counted part ends
  const endsAtMs = Date.parse(entryEndsAt(group, competition.entry))

  // Whether it has already passed, which is what makes a straddling transcript possible at all
  const isSpent = endsAtMs <= Date.now()

  // The counted part, which sits inside the clock either way
  const turns = [
    storedTurn(state, 'examiner', OPENER, endsAtMs - 40 * MINUTE_MS),
    storedTurn(
      state,
      'candidate',
      'I claim the only solutions are $a = b$. Suppose $a^2 + b = k^2$ for some integer $k$.',
      endsAtMs - 38 * MINUTE_MS
    ),
    storedTurn(state, 'examiner', SCRIPTED_REPLIES[0]!, endsAtMs - 37 * MINUTE_MS),
    storedTurn(
      state,
      'candidate',
      'Because $a^2 < a^2 + b < (a + 1)^2$ whenever $b \\le 2a$, so there is no square strictly between them.',
      endsAtMs - 30 * MINUTE_MS
    ),
    storedTurn(state, 'examiner', SCRIPTED_REPLIES[1]!, endsAtMs - 29 * MINUTE_MS),
  ]

  // And one exchange the clock no longer covers, once the boundary is behind us
  if (isSpent) {
    turns.push(
      storedTurn(
        state,
        'candidate',
        'Coming back to the case $b > 2a$ now that my time is gone: I think it forces $b = a^2 + a$.',
        endsAtMs + 4 * MINUTE_MS
      ),
      storedTurn(state, 'examiner', SCRIPTED_REPLIES[2]!, endsAtMs + 5 * MINUTE_MS)
    )
  }

  // The problem it is held against, which is the first of the set
  const problemId = problemIdOf(competition.slug.en, 1)

  // A number no conversation before it took
  state.minted++

  // The one conversation that problem opens with
  state.transcripts.set(problemId, [
    {
      id: `session-${state.minted}`,
      target: { kind: 'problem', problemId },
      turns,
      feedback: null,
      reports: [],
    },
  ])
}

/**
 * What opening a conversation sends, in as much of it as the fake reads.
 */
type StartRequestBody = {
  /** The problem being argued. */
  target: { problemId: string }
  /** What the turn opening the argument says. */
  content: string
}

/**
 * What rewinding a conversation sends.
 */
type RewindRequestBody = {
  /** The sequence of the last turn to keep; every later one goes. */
  keepThroughSequence: number
}

/**
 * What a further turn in an open conversation sends.
 */
type TurnRequestBody = {
  /** What the turn says. */
  content: string
}

/**
 * Stands in for the whole competitions backend on one page.
 *
 * The competitions calls are answered from memory, as are the defense conversations and the student's
 * Mathilda consent. Anything else the surface reads is somebody else's stub to install.
 *
 * @param page - The page to intercept requests on.
 * @param initial - Which state the student is in when the page opens.
 * @param options - What to vary about the student outside the states above.
 */
export async function installHostedBackend(
  page: Page,
  initial: HostedState,
  options: HostedBackendOptions = {}
): Promise<void> {
  // What this page's backend holds, which its calls read and write
  const state: FakeState = {
    view: buildView(initial),
    readiness: buildReadiness(initial),
    transcripts: new Map(),
    assessments: new Map(),
    minted: 0,
  }

  // Whatever was already said inside an entry the state opens with
  for (const group of state.view.groups) {
    // Every competition that group runs
    for (const competition of group.competitions) {
      seedStraddlingDefense(state, group, competition)

      // And whatever the student already claimed of the first solution in it
      if (options.standingNote !== undefined) {
        state.assessments.set(problemIdOf(competition.slug.en, 1), options.standingNote)
      }
    }
  }

  // When the student acknowledged what talking to Mathilda entails, null while they have not
  let consentedAt: string | null = options.hasConsented === false ? null : new Date().toISOString()

  // The acknowledgement the chat is gated on: where the student stands, and the call that gives it
  await page.route(`${BACKEND_ORIGIN}/users/me/ai-consent`, async (route) => {
    // Giving consent, which the gate does and nothing else can
    if (route.request().method() === 'POST') {
      // Acknowledged where the page's clock stands
      consentedAt = new Date(await pageNow(page)).toISOString()

      // Answered with nothing to say
      await answer(page, route, {})

      // Done, since what follows answers the read
      return
    }

    // Where the student stands
    await answer(page, route, { consentedAt } satisfies MathildaConsent)
  })

  // The whole surface in one read
  await page.route(`${BACKEND_ORIGIN}/competitions`, (route) => answer(page, route, state.view))

  // What the student's account already holds
  await page.route(`${BACKEND_ORIGIN}/competitions/readiness`, (route) =>
    answer(page, route, state.readiness)
  )

  // Every call that spends or closes an entry, and the read that serves a spent one's problems
  await page.route(`${BACKEND_ORIGIN}/competitions/*/*`, async (route) => {
    // The address the call came in on
    const segments = new URL(route.request().url()).pathname.split('/')

    // Which of the competition's endpoints
    const endpoint = segments.pop() ?? ''

    // Which competition it names
    const competitionSlug = segments.pop() ?? ''

    // The competition being acted on
    const competition = competitionIn(state, competitionSlug)

    // One nobody can find is a failure the caller surfaces like any other
    if (competition === undefined) {
      // Answered as a call for something that is not there
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })

      // Nothing to act on
      return
    }

    // What is being asked of that competition
    switch (endpoint) {
      // The clock starts now, and the call carries the acceptance with it
      case 'entry': {
        // The entry, started where the page's clock stands
        competition.entry = {
          kind: 'sat',
          startedAt: new Date(await pageNow(page)).toISOString(),
          finishedAt: null,
        }

        // Taking one is agreeing to the rules
        state.readiness.hasAcceptedRules = true

        // Answered with the entry and the problems it bought, which carry no solution: the clock has this
        // instant started
        await answer(page, route, {
          entry: competition.entry,
          problems: buildProblems(state, competition.slug.en, false),
        } satisfies SpentEntry)

        // Nothing else this call needs
        return
      }

      // Spent, and over in the same instant, so no clock ever runs
      case 'forfeit': {
        // The entry, given up where the page's clock stands
        competition.entry = {
          kind: 'forfeited',
          forfeitedAt: new Date(await pageNow(page)).toISOString(),
        }

        // Giving one up is agreeing to the rules just as taking it is
        state.readiness.hasAcceptedRules = true

        // Answered with the entry and the problems it bought, solutions and all: giving the entry up is
        // saying they are not competing here
        await answer(page, route, {
          entry: competition.entry,
          problems: buildProblems(state, competition.slug.en, true),
        } satisfies SpentEntry)

        // Nothing else this call needs
        return
      }

      // Over where the student said, and the clock they left on it goes with it
      case 'finish': {
        // The entry as it stands
        const entry = competition.entry

        // An entry can only be closed while the student is sitting it
        if (entry === null || entry.kind !== 'sat') {
          // Answered as a call for something that is not there
          await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })

          // Nothing to close
          return
        }

        // Closed where the page's clock stands, unless it already carries a close
        competition.entry = {
          ...entry,
          finishedAt: entry.finishedAt ?? new Date(await pageNow(page)).toISOString(),
        }

        // Answered with the entry as it now stands
        await answer(page, route, competition.entry)

        // Nothing else this call needs
        return
      }

      // The one place an embargoed statement is served
      case 'problems': {
        // How long a clock in this competition's group runs
        const clockMinutes = groupOf(state, competitionSlug)?.clockMinutes ?? CLOCK_MINUTES

        // Answered with the competition's whole set, carrying the solutions where they are owed them
        await answer(
          page,
          route,
          buildProblems(
            state,
            competition.slug.en,
            isSolutionOpen(competition.entry, clockMinutes, await pageNow(page))
          )
        )

        // Nothing else this read needs
        return
      }

      // Nothing else lives under a competition, so the run names it rather than inventing an answer
      default: {
        await route.fallback()
      }
    }
  })

  // What the student left about one solution. Registered after the pattern above for the same reason the
  // dismissal below is
  await page.route(`${BACKEND_ORIGIN}/competitions/*/problems/*/assessment`, async (route) => {
    // Which problem is being claimed about
    const problemId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''

    // Recording a note replaces whatever stood, and the delete drops it
    if (route.request().method() === 'PUT') {
      // What the student wrote
      const body = route.request().postDataJSON() as { comment: string }

      // Held as their one and only note about the problem
      state.assessments.set(problemId, body.comment)
    } else {
      // Nothing of theirs stands against it now
      state.assessments.delete(problemId)
    }

    // Nothing to hand back either way
    await route.fulfill({ status: 204, body: '' })
  })

  // The student asking not to be told about their unfinished profile again. Registered after the pattern
  // above, which would otherwise read "readiness" as a competition nobody can find: a later route is the
  // one Playwright tries first
  await page.route(`${BACKEND_ORIGIN}/competitions/readiness/dismissal`, async (route) => {
    // Only the write lives here
    if (route.request().method() !== 'POST') {
      // Passed on, so the run names it
      await route.fallback()

      // Nothing else answers on this path
      return
    }

    // Take their word for it, which is what the next readiness read will carry
    state.readiness.hasHiddenProfilePrompt = true

    // Nothing comes back
    await route.fulfill({ status: 204, body: '' })
  })

  // The examiner's canned lines, which the chat reads before it has anything else to show
  await page.route(`${BACKEND_ORIGIN}/defense/copy`, (route) =>
    answer(page, route, { opener: OPENER } satisfies DefenseCopy)
  )

  // The conversations held against one problem, and the caps a further one is held to
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/problems/*`, (route) => {
    // Which problem's conversations
    const problemId = new URL(route.request().url()).pathname.split('/').pop() ?? ''

    // Answered from memory, opening an empty transcript for a problem nobody has argued about
    return answer(page, route, {
      sessions: transcriptsOf(state, problemId),
      limits: LIMITS,
    } satisfies DefenseSessionList)
  })

  // Every conversation the student holds, across every problem, which is what the library lists
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/mine`, (route) =>
    answer(page, route, buildLibrary(state))
  )

  // Dropping a conversation, which the student may do with anything they are not graded on. The pattern
  // reaches the library read above too, so everything but the drop is passed back to it
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/*`, async (route) => {
    // Only dropping a conversation lives here
    if (route.request().method() !== 'DELETE') {
      // Passed on, so the read it was meant for answers it
      await route.fallback()

      // What follows drops a conversation, which this call is not
      return
    }

    // Which conversation is being dropped
    const sessionId = new URL(route.request().url()).pathname.split('/').pop() ?? ''

    // Out of whichever problem was holding it, so every list that reads the same memory follows
    for (const sessions of state.transcripts.values()) {
      // Where it sits among that problem's conversations, absent when it is another problem's
      const index = sessions.findIndex((candidate) => candidate.id === sessionId)

      // Taken out where it was found
      if (index !== -1) {
        sessions.splice(index, 1)
      }
    }

    // Answered with nothing, the way the backend answers a drop
    await route.fulfill({ status: 204, body: '' })
  })

  // Rewinding a conversation to a chosen turn, dropping everything said after it
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/*/rewind`, async (route) => {
    // Which conversation is being rewound
    const sessionId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''

    // How much of the conversation the student is keeping
    const { keepThroughSequence } = route.request().postDataJSON() as RewindRequestBody

    // Wherever it is being held
    const session = [...state.transcripts.values()]
      .flat()
      .find((candidate) => candidate.id === sessionId)

    // One nobody can find is a failure the caller surfaces like any other
    if (session === undefined) {
      // Answered as a call for something that is not there
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })

      // Nothing to rewind
      return
    }

    // The cut point must land on an examiner turn, so the rewound conversation awaits the student. A client
    // that miscounts asks for a candidate one, which the site refuses
    if (session.turns[keepThroughSequence]?.role !== 'examiner') {
      // Answered as a rewind point that is not one
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ errorCode: 'DefenseRewindTarget' }),
      })

      // Nothing is dropped on a cut point the conversation cannot take
      return
    }

    // The kept prefix, which is what every later read of the conversation comes back with
    session.turns = session.turns.slice(0, keepThroughSequence + 1)

    // Answered with nothing, the way the backend answers a rewind
    await route.fulfill({ status: 204, body: '' })
  })

  // Opening a conversation, which starts on the examiner's own line and answers the first turn
  await page.route(`${BACKEND_ORIGIN}/defense/sessions`, async (route) => {
    // Only opening a conversation lives here
    if (route.request().method() !== 'POST') {
      // Passed on, so the run names it
      await route.fallback()

      // What follows opens a conversation, which this call is not
      return
    }

    // What is being argued, and the turn opening the argument
    const body = route.request().postDataJSON() as StartRequestBody

    // When the turn reached the backend. The greeting belongs to the same instant: it is what the
    // conversation was opened on, so it cannot be stamped after the turn that asked for it.
    const receivedAt = await pageNow(page)

    // Take as long over the opening as every call takes
    await think(page)

    // A number no conversation before it took
    state.minted++

    // Opened on the examiner's line, then the student's turn, then her reply to it
    const session: DefenseSession = {
      id: `session-${state.minted}`,
      target: { kind: 'problem', problemId: body.target.problemId },
      turns: [
        storedTurn(state, 'examiner', OPENER, receivedAt),
        storedTurn(state, 'candidate', body.content, receivedAt + 1),
        // Stamped where it was actually said, which is once there is a reply to say
        storedTurn(state, 'examiner', SCRIPTED_REPLIES[0]!, await pageNow(page)),
      ],
      feedback: null,
      reports: [],
    }

    // Newest first, which is the order the rows are read in
    transcriptsOf(state, body.target.problemId).unshift(session)

    // Answered with the conversation as it now stands
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    })
  })

  // Every further turn in an open conversation
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/*/turns`, async (route) => {
    // Which conversation the turn belongs to
    const sessionId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''

    // What the student just said
    const { content } = route.request().postDataJSON() as TurnRequestBody

    // Wherever it is being held
    const session = [...state.transcripts.values()]
      .flat()
      .find((candidate) => candidate.id === sessionId)

    // One nobody can find is a failure the caller surfaces like any other
    if (session === undefined) {
      // Answered as a call for something that is not there
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })

      // Nothing to add a turn to
      return
    }

    // When the turn reached the backend. The entry's clock counts a turn by this stamp, so one taken
    // after the reply was written would spend the examiner's thinking time out of the student's clock.
    const receivedAt = await pageNow(page)

    // Take as long over the turn as every call takes
    await think(page)

    // How many the student has spent, which is what picks the reply
    const spent = session.turns.filter((turn) => turn.role === 'candidate').length

    // The turn where it landed, and the reply where it was actually said
    session.turns.push(
      storedTurn(state, 'candidate', content, receivedAt),
      storedTurn(
        state,
        'examiner',
        SCRIPTED_REPLIES[spent % SCRIPTED_REPLIES.length]!,
        await pageNow(page)
      )
    )

    // Answered with the conversation as it now stands
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    })
  })
}
