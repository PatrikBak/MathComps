import { MAX_MARK } from '@/components/features/admin/grades/model/grade-types'
import type {
  DefenseSession,
  DefenseSessionListItem,
  DefenseSessionTarget,
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
  HostedCompetitionGroup,
  HostedCompetitionProblem,
  HostedCompetitionsView,
} from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { MINUTE_MS } from '@/components/shared/utils/time-units'
import type { PartialLocalizedString } from '@/i18n/i18n'

import {
  HINTS,
  LIMITS,
  OPENER,
  SCRIPTED_REPLIES,
  SOLUTIONS,
  STATEMENTS,
} from './hosted-backend-content'
import { CLOCK_MINUTES, PROBLEMS_PER_COMPETITION } from './hosted-backend-world'

/**
 * What one page's fake backend remembers, and everything that reads or writes it.
 */

/**
 * A conversation as the fake keeps it: everything the backend stores of it, short of whether its statement is
 * still one the problem has, which every read weighs again.
 */
export type HeldSession = Omit<DefenseSession, 'hasOlderStatement' | 'target'> & {
  /** The problem it is about. */
  target: Extract<DefenseSessionTarget, { kind: 'problem' }>
}

/**
 * A function which reads a problem's statement in each language it is written in, as it stands now.
 *
 * @param problemId - The problem.
 *
 * @returns The problem's statements; none for a problem the lookup does not know.
 */
export type StatementLookup = (problemId: string) => PartialLocalizedString

/**
 * Everything one page's fake backend currently holds.
 *
 * One of these per installed fake, so two tests running side by side never write over each other and a
 * reload finds what the call before it left.
 */
export type FakeState = {
  /** Every group, in the order they are listed. */
  view: HostedCompetitionsView
  /** Whether the student has what an entry needs of them. */
  readiness: EntryReadiness
  /** Reads the statements of every problem no competition here sets, which the test owning them keeps current. */
  statementsOutside: StatementLookup
  /** Each problem's conversations, most recently opened first, by problem id. */
  transcripts: Map<string, HeldSession[]>
  /** What the student left about each solution, by problem id, for the ones they have said anything about. */
  assessments: Map<string, string>
  /**
   * The conversation held about a handout, which belongs to no competition and so sits beside the
   * transcripts. Null once it has been dropped.
   */
  handoutSession: DefenseSessionListItem | null
  /** How many ids have been minted, so nothing collides with anything minted before it. */
  minted: number
}

/**
 * Names one problem of one competition's set.
 *
 * @param competitionSlug - Which competition the set belongs to.
 * @param position - Where the problem sits in it, counting from one.
 *
 * @returns The problem's id.
 */
export function problemIdOf(competitionSlug: string, position: number): string {
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
export function storedTurn(
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
 * @returns The conversations, most recently opened first.
 */
export function transcriptsOf(state: FakeState, problemId: string): HeldSession[] {
  // What is already there
  const existing = state.transcripts.get(problemId)

  // A problem already argued about hands back what it holds
  if (existing !== undefined) {
    return existing
  }

  // One nobody has argued about yet starts with nothing
  const opened: HeldSession[] = []

  // Which is what it holds from here
  state.transcripts.set(problemId, opened)

  // And what this ask and every later one reads
  return opened
}

/**
 * Reads a problem's statement in each language it is written in, as it stands now: a competition's problem as
 * its set states it, any other through the lookup the test owning it handed the fake.
 *
 * @param state - The fake's memory.
 * @param problemId - The problem.
 *
 * @returns The problem's statements.
 */
export function statementsOf(state: FakeState, problemId: string): PartialLocalizedString {
  // The statement set at the problem's place, in whichever competition sets it
  const setStatement = state.view.groups
    .flatMap((group) => group.competitions)
    .flatMap((competition) =>
      STATEMENTS.slice(0, PROBLEMS_PER_COMPETITION).filter(
        (_statement, index) => problemIdOf(competition.slug.en, index + 1) === problemId
      )
    )[0]

  // That one, or the test's word for a problem no competition sets
  return setStatement ?? state.statementsOutside(problemId)
}

/**
 * A held conversation as the backend serves it, saying whether the problem it is about still has the statement
 * it was argued against in any language.
 *
 * @param state - The fake's memory.
 * @param session - The conversation.
 *
 * @returns The conversation, as read now.
 */
export function servedSession(state: FakeState, session: HeldSession): DefenseSession {
  // Every statement the problem has now
  const statements = Object.values(statementsOf(state, session.target.problemId))

  // The conversation, said to be argued against an older one once its own is among none of them
  return { ...session, hasOlderStatement: !statements.includes(session.statement) }
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
export function buildProblems(
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
      hints: isSolutionOpen ? (HINTS[index] ?? null) : null,
      defenses,
      selfAssessment: state.assessments.get(id) ?? null,
      maxCommentChars: LIMITS.maxFeedbackCommentChars,
      result: null,
    }
  })
}

/**
 * Marks every problem of a set final for good, the way the real backend hands a student their marks once they
 * are out: a full mark with none of it from Mathilda, and a thread with the graders nobody has written in yet.
 *
 * @param problems - The set as the student reads it.
 *
 * @returns The same set, every problem marked.
 */
export function withFinalMarks(problems: HostedCompetitionProblem[]): HostedCompetitionProblem[] {
  // Each problem, carrying its mark and the thread that opens with it
  return problems.map((problem) => ({
    ...problem,
    result: {
      kind: 'final',
      mark: MAX_MARK,
      help: 0,
      conversation: { targetId: `${problem.id}:student`, messageCount: 0 },
    },
  }))
}

/**
 * Mirrors the rule the real backend serves an official solution under: it is open unless a clock of the
 * student's own is still running, or a reader who prepares competitions is reaching a set still embargoed.
 *
 * @param group - The group the competition runs in, whose clock the run is held to, absent only where nothing
 * holds the competition at all.
 * @param competition - The competition whose set is being read, carrying the entry the student holds in it.
 * @param preparesCompetitions - Whether this reader prepares competitions.
 * @param now - The instant to read the clock against, in epoch milliseconds.
 *
 * @returns Whether the set may carry its solutions.
 */
export function isSolutionOpen(
  group: HostedCompetitionGroup | undefined,
  competition: HostedCompetition,
  preparesCompetitions: boolean,
  now: number
): boolean {
  // The entry the student holds here, absent while they hold none
  const entry = competition.entry

  // No entry means a public set, except for a reader who prepares competitions, whose own run has yet to
  // start
  if (entry === null) {
    return !preparesCompetitions || competition.problemsPublished
  }

  // Given up for the problems, so no clock ever ran to protect
  if (entry.kind === 'forfeited') {
    return true
  }

  // Closed by the student, whatever they left on the clock
  if (entry.finishedAt !== null) {
    return true
  }

  // Otherwise the clock says it
  return Date.parse(entry.startedAt) + (group?.clockMinutes ?? CLOCK_MINUTES) * MINUTE_MS <= now
}

/**
 * Mirrors the rule the real backend takes an entry under: a group takes them inside its own window, and a
 * reader who prepares competitions is held to neither end of it.
 *
 * @param group - The group the entry would be spent into.
 * @param preparesCompetitions - Whether this reader prepares competitions.
 * @param now - The instant to read the window against, in epoch milliseconds.
 *
 * @returns Whether the entry may be spent.
 */
export function isGroupTakingEntries(
  group: HostedCompetitionGroup,
  preparesCompetitions: boolean,
  now: number
): boolean {
  // Nothing about the window reaches a reader who prepares competitions
  if (preparesCompetitions) {
    return true
  }

  // Announced and not started yet
  if (Date.parse(group.opensAt) > now) {
    return false
  }

  // Over, which the practice one never is
  return group.closesAt === null || Date.parse(group.closesAt) > now
}

/**
 * Mirrors the rule the real backend serves a signed-in reader a competition's problems under: an entry of
 * their own opens them, so does a lifted embargo, and so does preparing competitions.
 *
 * @param competition - The competition whose set is being read.
 * @param preparesCompetitions - Whether this reader prepares competitions.
 *
 * @returns Whether the set may be served at all.
 */
export function areProblemsReadable(
  competition: HostedCompetition,
  preparesCompetitions: boolean
): boolean {
  // Any one of the three opens the set
  return preparesCompetitions || competition.entry !== null || competition.problemsPublished
}

/**
 * The group one competition runs in, which is what sets the clock its entry is measured by.
 *
 * @param state - The fake's memory.
 * @param competitionSlug - Which competition's group.
 *
 * @returns The group, or undefined when nothing holds that competition.
 */
export function groupOf(
  state: FakeState,
  competitionSlug: string
): HostedCompetitionGroup | undefined {
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
export function buildLibrary(state: FakeState): DefenseSessionListItem[] {
  // Every conversation of every problem of every competition, named by where it was set
  const competitionItems = state.view.groups.flatMap((group) =>
    group.competitions.flatMap((competition) =>
      Array.from({ length: PROBLEMS_PER_COMPETITION }, (_unused, index) => index + 1).flatMap(
        (position) => libraryItemsOf(state, group, competition.slug.en, position)
      )
    )
  )

  // Every conversation the student still holds, the handout one among them until it is dropped
  const items =
    state.handoutSession === null ? competitionItems : [...competitionItems, state.handoutSession]

  // Most recently spoken in first, the handout one oldest so the competition rows lead
  return items.sort((first, second) => second.lastActivityAt.localeCompare(first.lastActivityAt))
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
          { slug: 'mathcomps', displayName: 'MathComps', fullName: null },
          { slug: competitionSlug, displayName: group.name.en, fullName: null },
        ],
        number: position,
      },
    },
    statement: session.statement,
    lastActivityAt: session.turns.at(-1)?.createdAt ?? new Date(0).toISOString(),
    lastStudentMessage:
      session.turns.findLast((turn) => turn.role === 'candidate')?.content ?? null,
    isGraded: !isPracticeGroup(group),
  }))
}

/**
 * Finds one competition wherever its group sits.
 *
 * @param state - The fake's memory.
 * @param competitionSlug - Which competition to find.
 *
 * @returns The competition, or undefined when nothing is addressed by that slug.
 */
export function competitionIn(
  state: FakeState,
  competitionSlug: string
): HostedCompetition | undefined {
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
export function seedStraddlingDefense(
  state: FakeState,
  group: HostedCompetitionGroup,
  competition: HostedCompetition
): void {
  // Only an entry the student actually sat has a clock to have said anything inside
  if (competition.entry?.kind !== 'sat') {
    return
  }

  // The instant the counted part ends, which is what this fixture exists to straddle
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

  // The one conversation that problem opens with, argued in English against the statement the set has
  state.transcripts.set(problemId, [
    {
      id: `session-${state.minted}`,
      target: { kind: 'problem', problemId },
      statement: STATEMENTS[0]!.en,
      turns,
      feedback: null,
      reports: [],
    },
  ])
}

/**
 * Takes a conversation out of the backend's memory, so every list that reads it loses the row.
 *
 * @param state - What the backend holds.
 * @param sessionId - The conversation to take out.
 */
export function forgetSession(state: FakeState, sessionId: string): void {
  // Every problem's conversations, only one of which is holding it
  for (const sessions of state.transcripts.values()) {
    // Where it sits among that problem's conversations, absent when it is another problem's
    const index = sessions.findIndex((candidate) => candidate.id === sessionId)

    // Taken out where it was found
    if (index !== -1) {
      sessions.splice(index, 1)
    }
  }

  // The handout conversation, which no problem's transcripts hold
  if (state.handoutSession?.id === sessionId) {
    state.handoutSession = null
  }
}
