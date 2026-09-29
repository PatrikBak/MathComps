import type { Page } from '@playwright/test'

import type {
  AdminConversation,
  StudentGrading,
} from '@/components/features/admin/conversation/model/admin-conversation'
import {
  type Grade,
  type GradeChange,
  pairKey,
} from '@/components/features/admin/grades/model/grade-types'
import type {
  GradeSummary,
  GradingBoard,
} from '@/components/features/admin/grading-board/model/grading-types'

import { wholeConversationOf } from './admin-conversation'
import { createAnswerGate } from './answer-gate'
import { BACKEND_ORIGIN } from './backend-routes'
import { type ConversationBackend, installConversationBackend } from './conversation-backend'

/** The grader every grade the fake writes is stamped by. */
const GRADER = { id: 'grader', username: 'Grader', email: null }

/** A grade already given, pre-graded, before the page opens. */
const PRE_GRADED: Grade = {
  mark: 4,
  help: 0,
  internalComment: '',
  isFinal: false,
  updatedAt: '2026-09-27T09:00:00Z',
  updatedBy: GRADER,
}

/** What the fake's group is called, in English. */
export const GROUP_NAME = 'September round'

/**
 * The board the fake opens on: two competitions, the first with three students on two problems. Ada spoke about
 * her first problem twice while her entry counted and once more after she handed in, and was pre-graded on her
 * second; Bruno was graded final on his first and never spoke about his second; and Cyril is not graded yet. The
 * second competition holds Dora, who spoke about its problem twice, and Ada again, who entered it too and never
 * spoke about it, so four students made five entries.
 */
const BOARD: GradingBoard = {
  name: { sk: 'Septembrové kolo', cs: 'Zářijové kolo', en: GROUP_NAME },
  opensAt: '2026-09-01T00:00:00Z',
  closesAt: '2026-09-14T22:00:00Z',
  competitions: [
    {
      roundId: 'elementary-round',
      category: 'elementary',
      problems: [
        { id: 'p1', slug: 'elementary-1', number: 1 },
        { id: 'p2', slug: 'elementary-2', number: 2 },
      ],
      entrants: [
        { id: 'ada', username: 'Ada', email: null },
        { id: 'bruno', username: 'Bruno', email: null },
        { id: 'cyril', username: 'Cyril', email: null },
      ],
      grades: [
        { userId: 'ada', problemId: 'p1', conversationCount: 2, grade: null },
        { userId: 'ada', problemId: 'p2', conversationCount: 1, grade: PRE_GRADED },
        {
          userId: 'bruno',
          problemId: 'p1',
          conversationCount: 1,
          grade: { ...PRE_GRADED, mark: 6, isFinal: true },
        },
        { userId: 'bruno', problemId: 'p2', conversationCount: 0, grade: null },
        { userId: 'cyril', problemId: 'p1', conversationCount: 1, grade: null },
        { userId: 'cyril', problemId: 'p2', conversationCount: 1, grade: null },
      ],
    },
    {
      roundId: 'intermediate-round',
      category: 'intermediate',
      problems: [{ id: 'q1', slug: 'intermediate-1', number: 1 }],
      entrants: [
        { id: 'ada', username: 'Ada', email: null },
        { id: 'dora', username: 'Dora', email: null },
      ],
      grades: [
        { userId: 'ada', problemId: 'q1', conversationCount: 0, grade: null },
        { userId: 'dora', problemId: 'q1', conversationCount: 2, grade: null },
      ],
    },
  ],
}

/** How many conversations each student started about each problem after handing in, by `user|problem`. */
const AFTER_HAND_IN: Record<string, number> = { 'ada|p1': 1 }

/**
 * One change the page sent, and which grade it was sent to.
 */
type SentChange = {
  /** The student and problem, as `user|problem`. */
  pair: string
  /** What the page sent. */
  change: GradeChange
}

/**
 * The grading backend, held in memory, and what the page has asked of it.
 */
type GradingBackend = ConversationBackend & {
  /** Every change sent so far, oldest first. */
  changes: () => SentChange[]
  /** Keeps every change from here on waiting, until the function handed back lets them through. */
  hold: () => () => void
}

/**
 * What to vary about the fake.
 */
type GradingBackendOptions = {
  /** Which changes the backend refuses as leaving a grade invalid. Absent while every change is taken. */
  refuses?: (change: GradeChange) => boolean
}

/**
 * Lands a change on a grade the way the backend lands one it takes: a lowered mark pulls the help down with it
 * unless the change sets the help too, and taking the mark back clears the help and settles nothing. A change is
 * refused only where the fake's options say so.
 *
 * @param grade - The grade as it stands; null while none is given.
 * @param change - What the page sent.
 *
 * @returns The grade as it now stands; null while there still is none.
 */
function applyAsBackend(grade: Grade | null, change: GradeChange): Grade | null {
  // The mark the change leaves
  const mark = change.mark === undefined ? (grade?.mark ?? null) : change.mark.value

  // The help, pulled down under a lowered mark and cleared with a mark taken back
  const help = change.help ?? (mark === null ? 0 : Math.min(grade?.help ?? 0, mark))

  // The comment the change leaves
  const internalComment = change.internalComment ?? grade?.internalComment ?? ''

  // Whether it is final, which only ever stands beside a mark
  const isFinal = mark !== null && (change.isFinal ?? grade?.isFinal ?? false)

  // A change that leaves an ungraded student ungraded writes nothing
  if (grade === null && mark === null && internalComment === '') return null

  // The grade as it now stands
  return {
    mark,
    help,
    internalComment,
    isFinal,
    updatedAt: '2026-09-27T10:00:00Z',
    updatedBy: GRADER,
  }
}

/**
 * Builds every conversation the board's students held about its problems: the ones their entries counted, then
 * the ones started after they handed in, oldest first. Each first answer names the student, problem and
 * conversation it belongs to.
 *
 * @param board - The board the students and problems are read off.
 *
 * @returns The conversations, by the pair they belong to.
 */
function conversationsOf(board: GradingBoard): ReadonlyMap<string, AdminConversation[]> {
  // Every entrant on every problem of every competition, each with the conversations it holds
  return new Map(
    board.competitions.flatMap((competition) =>
      competition.grades.flatMap((summary): [string, AdminConversation[]][] => {
        // The student, as the competition names them
        const user = competition.entrants.find((entrant) => entrant.id === summary.userId)

        // The problem, with its place in the competition
        const problem = competition.problems.find((candidate) => candidate.id === summary.problemId)

        // Nothing to build for a pair the board doesn't name in full
        if (user === undefined || problem === undefined) return []

        // How many conversations the pair holds, those after the hand-in last
        const count = summary.conversationCount + (AFTER_HAND_IN[`${user.id}|${problem.id}`] ?? 0)

        // Each conversation whole, oldest first, its first answer saying whose it is
        const conversations = Array.from({ length: count }, (_unused, index) => {
          // The conversation, held against the archive problem the pair is graded on
          return wholeConversationOf({
            id: `${user.id}-${problem.id}-${index + 1}`,
            user,
            target: {
              kind: 'problem',
              problemId: problem.id,
              competitionSlug: 'mathilding',
              slug: problem.slug,
              source: {
                season: { slug: '1', displayName: 'Season 1', fullName: null },
                startYear: 2026,
                competition: [{ slug: 'mathilding', displayName: 'Mathilding', fullName: null }],
                number: problem.number,
              },
            },
            statement: `The statement of ${problem.id}.`,
            reference: `The reference for ${problem.id}.`,
            answer: `Answer ${index + 1} by ${user.id} on ${problem.id}.`,
            startedAt: `2026-09-2${index + 1}T10:00:00Z`,
          })
        })

        // Held under the pair they belong to
        return [[pairKey(user.id, problem.id), conversations]]
      })
    )
  )
}

/**
 * Reads where one student stands on the grade for one problem, as the board holds it.
 *
 * @param grades - Every grade the board holds, as the backend holds them.
 * @param held - The pair's conversations, oldest first, the ones the entry counted leading.
 * @param userId - The student.
 * @param problemId - The problem.
 *
 * @returns The grading, with the conversations the entry counted; null for a pair the board doesn't hold.
 */
function gradingOf(
  grades: readonly GradeSummary[],
  held: readonly AdminConversation[],
  userId: string,
  problemId: string
): StudentGrading | null {
  // Where the board holds the grade
  const summary = grades.find(
    (candidate) => candidate.userId === userId && candidate.problemId === problemId
  )

  // A pair the board doesn't hold is nobody's to grade
  if (summary === undefined) return null

  // Ada said something about her first solution, and nobody else said anything
  const selfAssessment =
    userId === 'ada' && problemId === 'p1'
      ? // What she said
        { comment: 'I think it is complete.', updatedAt: '2026-09-21T11:00:00Z' }
      : // Nothing, from everyone else
        null

  // The grade as it stands, read from the conversations the entry counted
  return {
    countingConversationIds: held
      .slice(0, summary.conversationCount)
      .map((conversation) => conversation.id),
    grade: summary.grade,
    selfAssessment,
  }
}

/**
 * Stands in for the grading endpoints of one group: its board, each change to a grade, and everything the
 * conversation dialog reads and writes.
 *
 * @param page - The page to intercept requests on.
 * @param groupSlug - The group the board is served for.
 * @param options - What to vary about the fake.
 *
 * @returns The backend, to watch and to hold.
 */
export async function installGradingBackend(
  page: Page,
  groupSlug: string,
  options: GradingBackendOptions = {}
): Promise<GradingBackend> {
  // The board as the backend holds it, written to by every change it takes
  const board = structuredClone(BOARD)

  // Every grade on it, the same objects the board holds so a change lands on both
  const grades = board.competitions.flatMap((competition) => competition.grades)

  // Every conversation the board's students held, by the pair it belongs to
  const conversationsByPair = conversationsOf(board)

  // Every conversation, in one list
  const conversations = [...conversationsByPair.values()].flat()

  // Every change sent, in the order it arrived
  const sent: SentChange[] = []

  // What a change waits at before it is answered
  const answers = createAnswerGate()

  // The board itself
  await page.route(`${BACKEND_ORIGIN}/admin/grading/groups/${groupSlug}`, (route) =>
    route.fulfill({ json: board })
  )

  // What the conversation dialog reads, graded the way the board stands
  const { readMarks } = await installConversationBackend(
    page,
    () => conversations,
    (userId, problemId) =>
      gradingOf(
        grades,
        conversationsByPair.get(pairKey(userId, problemId)) ?? [],
        userId,
        problemId
      )
  )

  // One grade, changed
  await page.route(`${BACKEND_ORIGIN}/admin/grading/problems/*/students/*`, async (route) => {
    // Which grade, named by the path's problem and student
    const segments = new URL(route.request().url()).pathname.split('/')
    const problemId = segments.at(-3) ?? ''
    const userId = segments.at(-1) ?? ''

    // Where the board holds it
    const summary = grades.find(
      (candidate) => candidate.userId === userId && candidate.problemId === problemId
    )

    // A grade the board doesn't hold, answered as not found
    if (summary === undefined) return route.fulfill({ status: 404 })

    // What the page sent
    const change = route.request().postDataJSON() as GradeChange

    // Recorded as it arrives, so a held change is still seen
    sent.push({ pair: `${userId}|${problemId}`, change })

    // Answered only once whatever holds it lets go
    await answers.passed()

    // A change the backend turns down leaves the grade as it was
    if (options.refuses?.(change) === true) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ errorCode: 'HostedGradeValue' }),
      })
    }

    // Taken, the grade moved to where the change leaves it
    summary.grade = applyAsBackend(summary.grade, change)

    // Answered with where the grade now stands
    return summary.grade === null
      ? // Nothing, while there is still no grade
        route.fulfill({ status: 204 })
      : // The grade
        route.fulfill({ json: summary.grade })
  })

  // A function which snapshots the changes so far, so the list cannot grow underneath an assertion
  const changes = () => [...sent]

  // The backend, to watch and to hold
  return { changes, hold: answers.hold, readMarks }
}
