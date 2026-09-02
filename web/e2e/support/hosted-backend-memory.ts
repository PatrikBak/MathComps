import type {
  DefenseSession,
  DefenseSessionListItem,
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
} from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { MINUTE_MS } from '@/components/shared/utils/time-units'

import { LIMITS, OPENER, SCRIPTED_REPLIES, SOLUTIONS, STATEMENTS } from './hosted-backend-content'
import { PROBLEMS_PER_COMPETITION } from './hosted-backend-world'

/**
 * What one page's fake backend remembers, and everything that reads or writes it.
 */

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
  /** Each problem's conversations, most recently active first, by problem id. */
  transcripts: Map<string, DefenseSession[]>
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
 * @returns The conversations, most recently active first.
 */
export function transcriptsOf(state: FakeState, problemId: string): DefenseSession[] {
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
export function isSolutionOpen(
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
